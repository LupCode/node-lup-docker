import fs from 'fs';
import http from 'http';
import net from 'net';
import { Readable } from 'stream';
import { DockerClientOptions, DockerContainer, DockerContainerStats, DockerCreateContainerOptions, DockerCreateContainerResponse, DockerCreateContainerResponseDockerError, DockerError, DockerGetContainerLogsOptions, DockerGetContainerLogsResponse, DockerGetContainerLogsResponseError, DockerGetContainerLogsResponseStream, DockerGetContainersOptions, DockerGetContainerStatsOptions, DockerGetContainerStatsResponseError, DockerGetContainerStatsResult, DockerResult, DockerSuccess } from "./types";
import { DockerStatsStream, DockerLogStream } from './stream';
import { decodeDockerContainer, decodeDockerContainerStats, encodeCreateContainerOptions } from './convert';


type DockerRequestResultBody = { 

    /** Response content type. */
    contentType: string;
    
    /** Actual response body (if stream is false). */
    body?: string;

    /** Actual response body as a WHATWG stream (if stream is true). */
    stream?: ReadableStream<Uint8Array>;

};

type DockerRequestResultStatus = {

    /** HTTP status code. */
    status: number;
    
    /** If the response is ok (based on status code). */
    ok: boolean;

};

type DockerRequestResult = DockerRequestResultStatus & (DockerError | DockerRequestResultBody);



class DockerClient {
    private origin: string;
    private mode: 'unix' | 'npipe' | 'tcp' | undefined;
    private readyCallbacks: Array<() => void> = [];

    /**
     * Creates a new Docker client.
     * @param options Docker client options to use. If none provided connects to local Docker daemon.
     */
    constructor(options?: DockerClientOptions){
        if(options?.unixSocket){
            this.origin = typeof options?.unixSocket === 'string' ? options.unixSocket : '/var/run/docker.sock';
            this.setReady('unix');
        } else if(options?.windowsPipe){
            this.origin = (typeof options?.windowsPipe === 'string' ? options.windowsPipe : '//./pipe/docker_engine').replace(/\//g, '\\');
            this.setReady('npipe');
        } else if(options?.remote) {
            this.origin = 'http' + (options?.remote.tls ? 's' : '') + '://' + (options?.remote.host || 'localhost') + ':' + (options?.remote.port || 2375);
            this.setReady('tcp');
        } else {
            // auto detect
            this.origin = '/var/run/docker.sock';
            const hasUnixSocket = fs.existsSync(this.origin);
            if(hasUnixSocket){
                this.setReady('unix');
            } else {
                this.origin = '//./pipe/docker_engine'.replace(/\//g, '\\');
                this.existsNpipe(this.origin).then(hasWindowsPipe => {
                    if(hasWindowsPipe){
                        this.setReady('npipe');
                    } else {
                        this.origin = 'http://localhost:2375';
                        this.setReady('tcp');
                    }
                });
            }
        }
    }

    private async existsNpipe(path: string): Promise<boolean> {
        return new Promise((resolve) => {
            const client = net.connect({ path }, () => {
                client.end();
                resolve(true);
            });
            client.on('error', () => {
                resolve(false);
            });
        });
    }

    private async setReady(mode: 'unix' | 'npipe' | 'tcp'): Promise<void> {
        this.mode = mode;
        this.readyCallbacks.forEach(callback => callback());
        this.readyCallbacks = [];
    }

    private async checkReady(): Promise<void> {
        if(this.mode) return;
        return new Promise((resolve) => {
            if(this.mode) return resolve();
            this.readyCallbacks.push(resolve);
        });
    }

    /**
     * Sends a raw HTTP request to the Docker API.
     * 
     * @param method HTTP method to use for the request.
     * @param uri URI to send the request to (e.g. '/containers/json').
     * @param query Optional query parameters to include in the request.
     * @param body Optional request body.
     * @param stream Optional if the body should be interpreted as a stream.
     * @returns Response object.
     */
    public async request(method: 'GET' | 'POST', uri: string, query?: {[key: string]: string}, body?: string, stream?: boolean): Promise<DockerRequestResult> {
        await this.checkReady();

        const queryArr = Object.entries(query || {}).map<string>(entry => entry[0] + '=' + encodeURIComponent(entry[1]));
        uri = uri + (queryArr.length > 0 ? (uri.indexOf('?') === -1 ? '?' : '&') + queryArr.join('&') : '');

        // fetch
        if(this.mode === 'tcp'){
            return fetch(this.origin + uri, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body,
            }).then<DockerRequestResult>(async response => {
                const result: DockerRequestResultStatus & Partial<DockerRequestResultBody> & Partial<DockerError> = {
                    status: response.status,
                    ok: response.ok,
                };
                if(result.ok){
                    result.contentType = response.headers.get('Content-Type') || '';
                    if(stream){
                        result.stream = response.body as ReadableStream; // fetch already returns a WHATWG stream
                    } else {
                        result.body = await response.text();
                    }
                } else {
                    result.error = {
                        message: await response.text(),
                        httpStatus: result.status,
                    };
                    if(result.status === 400) result.error.badRequest = true;
                    if(result.status >= 500) result.error.engineDockerError = true;
                }
                return result as DockerRequestResult;
            });
        }
        
        // socket
        return new Promise((resolve, reject) => {
            const options: http.RequestOptions = {
                socketPath: this.origin,
                method,
                path: uri,
                headers: {
                    "content-type": "application/json"
                },
            };
            const req = http.request(options, res => {
                const result: DockerRequestResultStatus & Partial<DockerRequestResultBody> & Partial<DockerError> = {
                    status: res.statusCode || 500,
                    ok: (res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false),
                };

                // error response
                if(!result.ok){
                    result.error = {
                        message: '', // set below
                        httpStatus: result.status,
                    };
                    if(result.status === 400) result.error.badRequest = true;
                    if(result.status >= 500) result.error.engineDockerError = true;
                    // do not return immediately because error message is still missing at this point
                }
                result.contentType = res.headers['content-type'] || '';

                // string response
                if(!stream || !result.ok){
                    let data = '';
                    res.on('data', chunk => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        if(result.ok){
                            result.body = data;
                        } else {
                            result.error!.message = data;
                        }
                        resolve(result as DockerRequestResult);
                    });
                    return;
                }

                // stream response
                result.stream = Readable.toWeb(res) as ReadableStream<Uint8Array>;
                resolve(result as DockerRequestResult);
            });
            req.on('error', reject);
            if(body) req.write(body);
            req.end();
        });
    }

    /**
     * Sends a raw HTTP request to the Docker API and parses the response as JSON.
     * 
     * @param method HTTP method to use for the request.
     * @param uri URI to send the request to (e.g. '/containers/json').
     * @param query Optional query parameters to include in the request.
     * @param body Optional request body.
     * @returns Response object.
     * @template T Return type.
     */
    public async requestJson<T = any>(method: 'GET' | 'POST', uri: string, query?: {[key: string]: string}, body?: string): Promise<Partial<DockerError> & { status: number, ok: boolean, body?: T }> {
        return this.request(method, uri, query, body).then(res => {
            if(!res.ok) return res as any;
            return { ...res, body: JSON.parse((res as DockerRequestResultBody).body!) };
        });
    }



    





    // -------------------------------------------------
    // --- CONTAINERS ----------------------------------
    // -------------------------------------------------




    /**
     * Creates a Docker container.
     * 
     * @param image Name or reference of the image to use for creating the container.
     * @param options Options for creating the container.
     * @returns ContainerID and warnings or an error.
     */
    public async createContainer(image: string, options?: DockerCreateContainerOptions): Promise<DockerResult<DockerCreateContainerResponse, DockerCreateContainerResponseDockerError>> {
        const query: {[key: string]: string} = {};
        if(options?.name) query.name = options.name;
        if(options?.platform) query.platform = options.platform;

        const bodyStr = encodeCreateContainerOptions(image, options);

        return this.requestJson('POST', '/containers/create', query, bodyStr).then<DockerResult<DockerCreateContainerResponse, DockerCreateContainerResponseDockerError>>(response => {
            if(!response.ok || response.body.message){
                const res: DockerResult<DockerCreateContainerResponse, DockerCreateContainerResponseDockerError> = {
                    error: response.error!
                };
                if(response.status === 404) res.error!.imageNotFound = true;
                if(response.status === 409) res.error!.conflictingContainerName = true;
                return res;
            }

            return {
                success: {
                    containerId: response.body.Id,
                    warnings: response.body.Warnings || []
                }
            };
        });
    }




    /**
     * Returns the logs of a container either as string or as stream.
     * 
     * @param containerIdOrName ID or name of the container to return the logs from.
     * @param options Optional options for querying logs.
     * @returns Logs of the container or an error.
     */
    public async getContainerLogs(containerIdOrName: string, options?: DockerGetContainerLogsOptions): Promise<DockerResult<DockerGetContainerLogsResponse, DockerGetContainerLogsResponseError>> {
        const query: {[key: string]: string} = {};
        if(options?.since !== undefined) query.since = (Number.isInteger(options.since) ? options.since : Math.floor((options.since as Date).getTime() / 1000)).toString();
        if(options?.stdErr !== undefined) query.stderr = (options.stdErr ? 'true' : 'false');
        if(options?.stdOut !== undefined) query.stdout = (options.stdOut ? 'true' : 'false');
        if(options?.stream !== undefined) query.follow = 'true';
        if(options?.tail !== undefined) query.tail = options.tail.toString();
        if(options?.timestamps !== undefined) query.timestamps = (options.timestamps ? 'true' : 'false');
        if(options?.until !== undefined) query.until = (Number.isInteger(options.until) ? options.until : Math.floor((options.until as Date).getTime() / 1000)).toString();
        return this.request('GET', '/containers/' + containerIdOrName + '/logs', query, undefined, options?.stream).then(response => {
            if(!response.ok){
                const result: DockerResult<DockerGetContainerLogsResponse, DockerGetContainerLogsResponseError> = {
                    error: (response as DockerError).error
                };
                if(response.status === 404) result.error!.notFound = true;
                return result;
            }
            return (options?.stream ? {
                success: {
                    stream: new DockerLogStream((response as DockerRequestResultBody).contentType, (response as DockerRequestResultBody).stream!),
                }
            } : {
                success: {
                    text: (response as DockerRequestResultBody).body,
                }
            }) as DockerResult<DockerGetContainerLogsResponse, DockerGetContainerLogsResponseError>;
        });
    }




    /**
     * Returns a list of containers.
     * 
     * @param options Optional options for querying containers.
     * @returns List of containers or an error.
     */
    public async getContainers(options?: DockerGetContainersOptions): Promise<DockerResult<DockerContainer[]>> {
        const query: {[key: string]: string} = {};
        if(options?.all) query.all = 'true';
        if(options?.limit) query.limit = options.limit.toString();
        if(options?.size) query.size = 'true';
        if(options?.filters){
            const json: {[key: string]: string[] | number[] | boolean[]} = {};
            if(options.filters.ancestorImage) json.ancestor = Array.isArray(options.filters.ancestorImage) ? options.filters.ancestorImage : [options.filters.ancestorImage];
            if(options.filters.beforeContainer) json.before = Array.isArray(options.filters.beforeContainer) ? options.filters.beforeContainer : [options.filters.beforeContainer];
            if(options.filters.exitCode) json.exited = Array.isArray(options.filters.exitCode) ? options.filters.exitCode : [options.filters.exitCode];
            if(options.filters.exposedPorts) json.expose = Array.isArray(options.filters.exposedPorts) ? options.filters.exposedPorts : [options.filters.exposedPorts];
            if(options.filters.healthState) json.health = Array.isArray(options.filters.healthState) ? options.filters.healthState : [options.filters.healthState];
            if(options.filters.id) json.id = Array.isArray(options.filters.id) ? options.filters.id : [options.filters.id];
            if(options.filters.isTask) json['is-task'] = Array.isArray(options.filters.isTask) ? options.filters.isTask : [options.filters.isTask];
            if(options.filters.label) json.label = Array.isArray(options.filters.label) ? options.filters.label : [options.filters.label];
            if(options.filters.name) json.name = Array.isArray(options.filters.name) ? options.filters.name : [options.filters.name];
            if(options.filters.network) json.network = Array.isArray(options.filters.network) ? options.filters.network : [options.filters.network];
            if(options.filters.publishedPort) json.publish = Array.isArray(options.filters.publishedPort) ? options.filters.publishedPort : [options.filters.publishedPort];
            if(options.filters.sinceContainer) json.since = Array.isArray(options.filters.sinceContainer) ? options.filters.sinceContainer : [options.filters.sinceContainer];
            if(options.filters.state) json.status = Array.isArray(options.filters.state) ? options.filters.state : [options.filters.state];
            if(options.filters.volume) json.volume = Array.isArray(options.filters.volume) ? options.filters.volume : [options.filters.volume];
            if(options.filters.windowsIsolation) json.isolation = Array.isArray(options.filters.windowsIsolation) ? options.filters.windowsIsolation : [options.filters.windowsIsolation];
            if(Object.keys(json).length > 0) query.filters = JSON.stringify(json);
        }

        return this.requestJson('GET', '/containers/json', query).then<DockerResult<DockerContainer[]>>(response => {
            if(!response.ok || response.body.message){
                const result: DockerResult<DockerContainer[]> = {
                    error: response.error!
                };
                return result;
            }
            return {
                success: (response.body as any[]).map<DockerContainer>(json => decodeDockerContainer(json)!),
            };
        });
    }


    /**
     * Returns the utilization stats for a container as single value or as continuous stream.
     *
     * @param containerIdOrName ID or name of the container.
     * @param options Options for fetching the stats.
     * @returns Single stats object, stream of stat objects, or an error.
     */
    public async getContainerStats(containerIdOrName: string, options?: DockerGetContainerStatsOptions): Promise<DockerResult<DockerGetContainerStatsResult, DockerGetContainerStatsResponseError>> {
        const query: {[key: string]: string} = {};
        if(options?.oneShot) query['one-shot'] = 'true';
        query.stream = (options?.stream ? 'true' : 'false'); // always set because default is true if not set.

        return this.request('GET', '/containers/'+containerIdOrName+'/stats', query, undefined, options?.stream).then(response => {
            if(!response.ok){
                const result: DockerResult<DockerGetContainerStatsResult, DockerGetContainerStatsResponseError> = {
                    error: (response as DockerError).error
                };
                if(response.status === 404) result.error!.notFound = true;
                return result;
            }

            // single response
            if(!options?.stream){
                return {
                    success: {
                        single: decodeDockerContainerStats(JSON.parse((response as DockerRequestResultBody).body!))!,
                    }
                };
            }

            // stream
            return {
                success: {
                    stream: new DockerStatsStream((response as DockerRequestResultBody).stream!),
                }
            };
        });
    }











    // -------------------------------------------------
    // --- IMAGES --------------------------------------
    // -------------------------------------------------

    // TODO export
    // TODO import

}
export default DockerClient;