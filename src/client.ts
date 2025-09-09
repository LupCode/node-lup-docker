import fs from 'fs';
import http from 'http';
import net from 'net';
import {
  DockerClientOptions,
  DockerContainer,
  DockerCreateContainerOptions,
  DockerCreateContainerResponse,
  DockerCreateContainerResponseDockerError,
  DockerDeleteContainerOptions,
  DockerDeleteContainerResponseError,
  DockerError,
  DockerGetContainerLogsOptions,
  DockerGetContainerLogsResponseError,
  DockerGetContainersOptions,
  DockerGetContainerStatsOptions,
  DockerGetContainerStatsResponseError,
  DockerGetImagesOptions,
  DockerImage,
  DockerCreateImageOptions,
  DockerCreateImageResponseError,
  DockerKillContainerResponseError,
  DockerPullImageOptions,
  DockerPullImageResponseError,
  DockerRestartContainerOptions,
  DockerRestartContainerResponseError,
  DockerResult,
  DockerStartContainerResponseError,
  DockerStopContainerOptions,
  DockerStopContainerResponseError,
  DockerImportImagesOptions,
  DockerExportImageOptions,
  DockerExportImagesOptions,
  DockerContainerStats,
} from './types';
import { DockerStatsStream, DockerLogStream, DockerStatsStreamReader } from './stream';
import {
  decodeDockerContainer,
  decodeDockerContainerStats,
  decodeDockerImage,
  encodeCreateContainerOptions,
  encodeDockerCredentials,
  encodeDockerOCIPlatformToJson,
} from './convert';
import { Readable } from 'stream';

type DockerRequestOptions = {
  /** Optional request body. */
  body?: string | ArrayBuffer | ReadableStream;

  /** Optional HTTP headers to include in the request. */
  headers?: { [key: string]: string };

  /** Optional query parameters to include in the request. */
  query?: { [key: string]: string | string[] };

  /** Optional if the body should be interpreted as a stream. */
  stream?: boolean;
};

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
  private readyCallbacks: (() => void)[] = [];

  /**
   * Creates a new Docker client.
   * @param options Docker client options to use. If none provided connects to local Docker daemon.
   */
  constructor(options?: DockerClientOptions) {
    if (options?.unixSocket) {
      this.origin = typeof options?.unixSocket === 'string' ? options.unixSocket : '/var/run/docker.sock';
      this.setReady('unix');
    } else if (options?.windowsPipe) {
      this.origin = (typeof options?.windowsPipe === 'string' ? options.windowsPipe : '//./pipe/docker_engine').replace(
        /\//g,
        '\\',
      );
      this.setReady('npipe');
    } else if (options?.remote) {
      this.origin =
        'http' +
        (options?.remote.tls ? 's' : '') +
        '://' +
        (options?.remote.host || 'localhost') +
        ':' +
        (options?.remote.port || 2375);
      this.setReady('tcp');
    } else {
      // auto detect
      this.origin = '/var/run/docker.sock';
      const hasUnixSocket = fs.existsSync(this.origin);
      if (hasUnixSocket) {
        this.setReady('unix');
      } else {
        this.origin = '//./pipe/docker_engine'.replace(/\//g, '\\');
        this.existsNpipe(this.origin).then((hasWindowsPipe) => {
          if (hasWindowsPipe) {
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
    this.readyCallbacks.forEach((callback) => callback());
    this.readyCallbacks = [];
  }

  private async checkReady(): Promise<void> {
    if (this.mode) return;
    return new Promise((resolve) => {
      if (this.mode) return resolve();
      this.readyCallbacks.push(resolve);
    });
  }

  /**
   * Sends a raw HTTP request to the Docker API.
   *
   * @param method HTTP method to use for the request.
   * @param uri URI to send the request to (e.g. '/containers/json').
   * @param options Optional request options.
   *
   * @returns Response object.
   */
  public async request(
    method: 'GET' | 'POST' | 'DELETE',
    uri: string,
    options?: DockerRequestOptions,
  ): Promise<DockerRequestResult> {
    await this.checkReady();

    const queryArr = Object.entries(options?.query || {}).flatMap(([key, value]) => {
      if (Array.isArray(value)) {
        return value.map((v) => key + '=' + encodeURIComponent(v));
      }
      return key + '=' + encodeURIComponent(value);
    });
    uri = uri + (queryArr.length > 0 ? (uri.indexOf('?') === -1 ? '?' : '&') + queryArr.join('&') : '');

    // fetch
    if (this.mode === 'tcp') {
      return fetch(this.origin + uri, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: options?.body,
      }).then<DockerRequestResult>(async (response) => {
        const result: DockerRequestResultStatus & Partial<DockerRequestResultBody> & Partial<DockerError> = {
          status: response.status,
          ok: response.ok,
        };
        if (result.ok) {
          result.contentType = response.headers.get('Content-Type') || '';
          if (options?.stream) {
            result.stream = response.body as ReadableStream; // fetch already returns a WHATWG stream
          } else {
            result.body = await response.text();
          }
        } else {
          result.error = {
            message: await response.text(),
            httpStatus: result.status,
          };
          if (result.status === 400) result.error.badRequest = true;
          if (result.status >= 500) result.error.engineDockerError = true;
        }
        return result as DockerRequestResult;
      });
    }

    // socket
    return new Promise((resolve, reject) => {
      const reqOptions: http.RequestOptions = {
        socketPath: this.origin,
        method,
        path: uri,
        headers: {
          'content-type': 'application/json',
        },
      };
      const req = http.request(reqOptions, (res) => {
        const result: DockerRequestResultStatus & Partial<DockerRequestResultBody> & Partial<DockerError> = {
          status: res.statusCode || 500,
          ok: res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false,
        };

        // error response
        if (!result.ok) {
          result.error = {
            message: '', // set below
            httpStatus: result.status,
          };
          if (result.status === 400) result.error.badRequest = true;
          if (result.status >= 500) result.error.engineDockerError = true;
          // do not return immediately because error message is still missing at this point
        }
        result.contentType = res.headers['content-type'] || '';

        // string response
        if (!options?.stream || !result.ok) {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (result.ok) {
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
      if (options?.body) req.write(options.body);
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
  public async requestJson<T = any>(
    method: 'GET' | 'POST' | 'DELETE',
    uri: string,
    options?: DockerRequestOptions,
  ): Promise<Partial<DockerError> & { status: number; ok: boolean; body?: T }> {
    return this.request(method, uri, options).then((res) => {
      if (!res.ok) return res as any;
      return { ...res, body: JSON.parse((res as DockerRequestResultBody).body!) };
    });
  }

  // -------------------------------------------------
  // -------------------------------------------------
  // -------------------------------------------------

  /**
   * Creates a Docker container.
   *
   * @param image Name or reference of the image to use for creating the container.
   * @param options Options for creating the container.
   * @returns ContainerID and warnings or an error.
   */
  public async createContainer(
    image: string,
    options?: DockerCreateContainerOptions,
  ): Promise<DockerResult<DockerCreateContainerResponse, DockerCreateContainerResponseDockerError>> {
    const query: { [key: string]: string } = {};
    if (options?.name) query.name = options.name;
    if (options?.platform) query.platform = options.platform;

    const bodyStr = encodeCreateContainerOptions(image, options);

    return this.requestJson('POST', '/containers/create', { query, body: bodyStr }).then<
      DockerResult<DockerCreateContainerResponse, DockerCreateContainerResponseDockerError>
    >((response) => {
      if (!response.ok || response.body.message) {
        const res: DockerResult<DockerCreateContainerResponse, DockerCreateContainerResponseDockerError> = {
          error: response.error!,
        };
        if (response.status === 404) res.error!.imageNotFound = true;
        if (response.status === 409) res.error!.conflictingContainerName = true;
        return res;
      }

      return {
        success: {
          containerId: response.body.Id,
          warnings: response.body.Warnings || [],
        },
      };
    });
  }

  /**
   * Imports an image from an URL or directly from a buffer representing the root filesystem snapshot.
   * To pull an image from a registry use the pullImage() method.
   * To import an image from a saved container or that has been exported use the importImage() method.
   *
   * @param source Source of the image to import. Either a URL or a Buffer representing the root filesystem snapshot like debootstrap output.
   * @param options Optional parameters for importing the image.
   * @returns Empty object on success or an error.
   */
  public async createImage(
    source: string | URL | ArrayBuffer,
    options?: DockerCreateImageOptions,
  ): Promise<DockerResult<{}, DockerCreateImageResponseError>> {
    const query: { [key: string]: string | string[] } = {};
    if (options?.changes) query.changes = options.changes;
    if (options?.message) query.message = options.message;
    if (options?.name) query.repo = options.name;
    if (options?.platform) query.platform = options.platform;
    if (options?.tag) query.tag = options.tag;

    const headers: { [key: string]: string } = {};
    if (options?.registryAuth) headers['X-Registry-Auth'] = encodeDockerCredentials(options?.registryAuth);

    let body: ArrayBuffer | undefined = undefined;
    if (typeof source === 'string' || source instanceof URL) {
      query.fromSrc = source.toString();
    } else {
      query.fromSrc = '-'; // signal body
      headers['content-type'] = 'text/plain';
      body = source;
    }

    return this.request('POST', '/images/create', { query, body, headers }).then<
      DockerResult<{}, DockerCreateImageResponseError>
    >((response) => {
      if (!response.ok) {
        const res: DockerResult<{}, DockerCreateImageResponseError> = {
          error: (response as DockerError).error!,
        };
        if (response.status === 404) res.error!.notFound = true;
        return res;
      }
      return { success: {} };
    });
  }

  /**
   * Deletes a container.
   *
   * @param containerIdOrName ID or name of the container to delete.
   * @param options Optional options for deleting the container.
   * @returns Empty object on success or an error.
   */
  public async deleteContainer(
    containerIdOrName: string,
    options?: DockerDeleteContainerOptions,
  ): Promise<DockerResult<{}, DockerDeleteContainerResponseError>> {
    const query: { [key: string]: string | string[] } = {};
    if (options?.force) query.force = 'true';
    if (options?.link) query.link = 'true';
    if (options?.volumes) query.v = 'true';
    return this.requestJson('DELETE', '/containers/' + containerIdOrName, { query }).then<
      DockerResult<{}, DockerDeleteContainerResponseError>
    >((response) => {
      if (!response.ok || response.body.message) {
        const res: DockerResult<{}, DockerDeleteContainerResponseError> = {
          error: response.error!,
        };
        if (response.status === 404) res.error!.notFound = true;
        if (response.status === 409) res.error!.stillRunning = true;
        return res;
      }

      return {
        success: {},
      };
    });
  }

  /**
   * Exports an image as a TAR archive file including all its layers (parent images).
   *
   * @param imageIdOrName ID or name of the image (if name is provided, a repositories file is included with the information about the repository).
   * @param options Additional options for exporting the image.
   * @returns A stream of the exported image TAR archive.
   */
  public async exportImage(
    imageIdOrName: string,
    options?: DockerExportImageOptions,
  ): Promise<DockerResult<ReadableStream<Uint8Array>>> {
    const query: { [key: string]: string | string[] } = {};
    if (options?.platform) query.platform = encodeDockerOCIPlatformToJson(options.platform);

    return this.request('GET', '/images/' + imageIdOrName + '/get', { query, stream: true }).then<
      DockerResult<ReadableStream<Uint8Array>>
    >((response) => {
      if (!response.ok) {
        return { error: (response as DockerError).error! };
      }
      return { success: (response as DockerRequestResultBody).stream! };
    });
  }

  /**
   * Exports multiple images as a TAR archive file including all their layers (parent images).
   *
   * @param options Additional options for exporting the images.
   * @returns A stream of the exported images TAR archive.
   */
  public async exportImages(options?: DockerExportImagesOptions): Promise<DockerResult<ReadableStream<Uint8Array>>> {
    const query: { [key: string]: string | string[] } = {};
    if (options?.names) query.names = typeof options.names === 'string' ? [options.names] : options.names;
    if (options?.platform) query.platform = encodeDockerOCIPlatformToJson(options.platform);

    return this.request('GET', '/images/get', { query, stream: true }).then<DockerResult<ReadableStream<Uint8Array>>>(
      (response) => {
        if (!response.ok) {
          return { error: (response as DockerError).error! };
        }
        return { success: (response as DockerRequestResultBody).stream! };
      },
    );
  }

  /**
   * Returns the logs of a container as string.
   *
   * @param containerIdOrName ID or name of the container to return the logs from.
   * @param options Optional options for querying logs.
   * @returns Logs of the container as a string or an error.
   */
  public async getContainerLogs(
    containerIdOrName: string,
    options?: DockerGetContainerLogsOptions,
  ): Promise<DockerResult<string, DockerGetContainerLogsResponseError>> {
    const query: { [key: string]: string } = {};
    query.follow = 'false';
    if (options?.since !== undefined)
      query.since = (
        Number.isInteger(options.since) ? options.since : Math.floor((options.since as Date).getTime() / 1000)
      ).toString();
    if (options?.stdErr !== undefined) query.stderr = options.stdErr ? 'true' : 'false';
    if (options?.stdOut !== undefined) query.stdout = options.stdOut ? 'true' : 'false';
    if (options?.tail !== undefined) query.tail = options.tail.toString();
    if (options?.timestamps !== undefined) query.timestamps = options.timestamps ? 'true' : 'false';
    if (options?.until !== undefined)
      query.until = (
        Number.isInteger(options.until) ? options.until : Math.floor((options.until as Date).getTime() / 1000)
      ).toString();
    return this.request('GET', '/containers/' + containerIdOrName + '/logs', { query, stream: false }).then(
      (response) => {
        if (!response.ok) {
          const result: DockerResult<string, DockerGetContainerLogsResponseError> = {
            error: (response as DockerError).error,
          };
          if (response.status === 404) result.error!.notFound = true;
          return result;
        }
        return {
          success: (response as DockerRequestResultBody).body!,
        };
      },
    );
  }

  /**
   * Returns the logs of a container as a continuous stream.
   * If the container was created with tty=true, the logs will only be a stream of type stdout.
   *
   * @param containerIdOrName ID or name of the container to return the logs from.
   * @param options Optional options for querying logs.
   * @returns Logs of the container as stream or an error.
   */
  public async getContainerLogsStream(
    containerIdOrName: string,
    options?: DockerGetContainerLogsOptions,
  ): Promise<DockerResult<DockerLogStream, DockerGetContainerLogsResponseError>> {
    const query: { [key: string]: string } = {};
    query.follow = 'true';
    if (options?.since !== undefined)
      query.since = (
        Number.isInteger(options.since) ? options.since : Math.floor((options.since as Date).getTime() / 1000)
      ).toString();
    if (options?.stdErr !== undefined) query.stderr = options.stdErr ? 'true' : 'false';
    if (options?.stdOut !== undefined) query.stdout = options.stdOut ? 'true' : 'false';
    if (options?.tail !== undefined) query.tail = options.tail.toString();
    if (options?.timestamps !== undefined) query.timestamps = options.timestamps ? 'true' : 'false';
    if (options?.until !== undefined)
      query.until = (
        Number.isInteger(options.until) ? options.until : Math.floor((options.until as Date).getTime() / 1000)
      ).toString();
    return this.request('GET', '/containers/' + containerIdOrName + '/logs', { query, stream: true }).then(
      (response) => {
        if (!response.ok) {
          const result: DockerResult<DockerLogStream, DockerGetContainerLogsResponseError> = {
            error: (response as DockerError).error,
          };
          if (response.status === 404) result.error!.notFound = true;
          return result;
        }
        return {
          success: new DockerLogStream(
            (response as DockerRequestResultBody).contentType,
            (response as DockerRequestResultBody).stream!,
          ),
        };
      },
    );
  }

  /**
   * Returns a list of containers.
   *
   * @param options Optional options for querying containers.
   * @returns List of containers or an error.
   */
  public async getContainers(options?: DockerGetContainersOptions): Promise<DockerResult<DockerContainer[]>> {
    const query: { [key: string]: string | string[] } = {};
    if (options?.all) query.all = 'true';
    if (options?.limit) query.limit = options.limit.toString();
    if (options?.size) query.size = 'true';
    if (options?.filters) {
      const json: { [key: string]: string[] | number[] | boolean[] } = {};
      if (options.filters.ancestorImage)
        json.ancestor = Array.isArray(options.filters.ancestorImage)
          ? options.filters.ancestorImage
          : [options.filters.ancestorImage];
      if (options.filters.beforeContainer)
        json.before = Array.isArray(options.filters.beforeContainer)
          ? options.filters.beforeContainer
          : [options.filters.beforeContainer];
      if (options.filters.exitCode)
        json.exited = Array.isArray(options.filters.exitCode) ? options.filters.exitCode : [options.filters.exitCode];
      if (options.filters.exposedPorts)
        json.expose = Array.isArray(options.filters.exposedPorts)
          ? options.filters.exposedPorts
          : [options.filters.exposedPorts];
      if (options.filters.healthState)
        json.health = Array.isArray(options.filters.healthState)
          ? options.filters.healthState
          : [options.filters.healthState];
      if (options.filters.id) json.id = Array.isArray(options.filters.id) ? options.filters.id : [options.filters.id];
      if (options.filters.isTask)
        json['is-task'] = Array.isArray(options.filters.isTask) ? options.filters.isTask : [options.filters.isTask];
      if (options.filters.labels)
        json.label = Object.entries(options.filters.labels).map<string>((entry) =>
          entry[1] === undefined ? entry[0] : entry[0] + '=' + entry[1],
        );
      if (options.filters.name)
        json.name = Array.isArray(options.filters.name) ? options.filters.name : [options.filters.name];
      if (options.filters.network)
        json.network = Array.isArray(options.filters.network) ? options.filters.network : [options.filters.network];
      if (options.filters.publishedPort)
        json.publish = Array.isArray(options.filters.publishedPort)
          ? options.filters.publishedPort
          : [options.filters.publishedPort];
      if (options.filters.sinceContainer)
        json.since = Array.isArray(options.filters.sinceContainer)
          ? options.filters.sinceContainer
          : [options.filters.sinceContainer];
      if (options.filters.state)
        json.status = Array.isArray(options.filters.state) ? options.filters.state : [options.filters.state];
      if (options.filters.volume)
        json.volume = Array.isArray(options.filters.volume) ? options.filters.volume : [options.filters.volume];
      if (options.filters.windowsIsolation)
        json.isolation = Array.isArray(options.filters.windowsIsolation)
          ? options.filters.windowsIsolation
          : [options.filters.windowsIsolation];
      if (Object.keys(json).length > 0) query.filters = JSON.stringify(json);
    }

    return this.requestJson('GET', '/containers/json', { query }).then<DockerResult<DockerContainer[]>>((response) => {
      if (!response.ok || response.body.message) {
        return { error: response.error! };
      }
      return {
        success: (response.body as any[]).map<DockerContainer>((json) => decodeDockerContainer(json)!),
      };
    });
  }

  /**
   * Returns the utilization stats for a container as single value.
   *
   * @param containerIdOrName ID or name of the container.
   * @param options Options for fetching the stats.
   * @returns Stats object or an error.
   */
  public async getContainerStats(
    containerIdOrName: string,
    options?: DockerGetContainerStatsOptions,
  ): Promise<DockerResult<DockerContainerStats, DockerGetContainerStatsResponseError>> {
    const query: { [key: string]: string } = {};
    if (options?.oneShot) query['one-shot'] = 'true';
    query.stream = 'false';

    return this.request('GET', '/containers/' + containerIdOrName + '/stats', { query, stream: false }).then(
      (response) => {
        if (!response.ok) {
          const result: DockerResult<DockerContainerStats, DockerGetContainerStatsResponseError> = {
            error: (response as DockerError).error,
          };
          if (response.status === 404) result.error!.notFound = true;
          return result;
        }

        // stats object
        return {
          success: decodeDockerContainerStats(JSON.parse((response as DockerRequestResultBody).body!))!,
        };
      },
    );
  }

  /**
   * Returns the utilization stats for a container as a continuous stream
   * tunneled into a stream reader.
   *
   * @warning The stream will continuously produce stats objects which accumulate over time if not consumed!
   *
   * @param containerIdOrName ID or name of the container.
   * @returns Stream of stat objects tunneled into a stream reader or an error.
   */
  public async getContainerStatsReader(
    containerIdOrName: string,
  ): Promise<DockerResult<DockerStatsStreamReader, DockerGetContainerStatsResponseError>> {
    return this.getContainerStatsStream(containerIdOrName).then<
      DockerResult<DockerStatsStreamReader, DockerGetContainerStatsResponseError>
    >((result) =>
      result.success ? { success: new DockerStatsStreamReader(result.success!) } : { error: result.error! },
    );
  }

  /**
   * Returns the utilization stats for a container as a continuous stream.
   *
   * @param containerIdOrName ID or name of the container.
   * @returns Stream of stat objects or an error.
   */
  public async getContainerStatsStream(
    containerIdOrName: string,
  ): Promise<DockerResult<DockerStatsStream, DockerGetContainerStatsResponseError>> {
    const query: { [key: string]: string } = {};
    query.stream = 'true';

    return this.request('GET', '/containers/' + containerIdOrName + '/stats', { query, stream: true }).then(
      (response) => {
        if (!response.ok) {
          const result: DockerResult<DockerStatsStream, DockerGetContainerStatsResponseError> = {
            error: (response as DockerError).error,
          };
          if (response.status === 404) result.error!.notFound = true;
          return result;
        }

        // stream
        return {
          success: new DockerStatsStream((response as DockerRequestResultBody).stream!),
        };
      },
    );
  }

  /**
   * Returns a list of images.
   *
   * @param options Options for filtering the images.
   * @returns List of images or an error.
   */
  public async getImages(options?: DockerGetImagesOptions): Promise<DockerResult<DockerImage[]>> {
    const query: { [key: string]: string } = {};
    if (options?.all) query.all = 'true';
    if (options?.digests) query.digests = 'true';
    if (options?.filters) {
      const filters: { [key: string]: string | string[] } = {};
      if (options.filters.beforeImage) filters.before = options.filters.beforeImage;
      if (options.filters.dangling) filters.dangling = 'true';
      if (options.filters.labels)
        filters.label = Object.entries(options.filters.labels).map<string>((entry) =>
          entry[1] === undefined ? entry[0] : entry[0] + '=' + entry[1],
        );
      if (options.filters.reference) filters.reference = options.filters.reference;
      if (options.filters.sinceImage) filters.since = options.filters.sinceImage;
      if (options.filters.until) filters.until = Math.round(options.filters.until.getTime() / 1000).toString();
      query.filters = JSON.stringify(filters);
    }
    if (options?.manifests) query.manifests = 'true';
    if (options?.sharedSize) query['shared-size'] = 'true';
    return this.requestJson('GET', '/images/json', { query }).then<DockerResult<DockerImage[]>>((response) => {
      if (!response.ok) return { error: response.error! };
      return { success: (response.body as any[]).map<DockerImage>((image) => decodeDockerImage(image)!) };
    });
  }

  /**
   * Import one or multiple images from a TAR file that previously have been exported.
   *
   * @param imagesTar TAR archive file containing a set of images and tags.
   * @param options Additional options for importing the images.
   * @returns Empty object on success or an error.
   */
  public async importImages(
    imagesTar: ArrayBuffer | ReadableStream,
    options?: DockerImportImagesOptions,
  ): Promise<DockerResult> {
    const query: { [key: string]: string } = {};
    if (options?.platform) query.platform = encodeDockerOCIPlatformToJson(options.platform);
    if (options?.quiet) query.quiet = 'true';

    const headers: { [key: string]: string } = {};
    headers['content-type'] = 'application/x-tar';

    return this.request('POST', '/images/import', { query, body: imagesTar, headers }).then((response) => {
      if (!response.ok) return { error: (response as DockerError).error! };
      return { success: {} };
    });
  }

  /**
   * Kills a container or sends another signal to the container.
   * Killing a container is similar to stopping it except that it immediately terminates the container's processes.
   *
   * @param containerIdOrName ID or name of the container.
   * @param signal Optional signal to send to the container.
   * @returns Promise resolving to empty object on successful kill or an error.
   */
  public async killContainer(
    containerIdOrName: string,
    signal?: number | string,
  ): Promise<DockerResult<{}, DockerKillContainerResponseError>> {
    const query: { [key: string]: string } = {};
    if (signal) query.signal = signal.toString();
    return this.requestJson('POST', '/containers/' + containerIdOrName + '/kill', { query }).then<
      DockerResult<{}, DockerKillContainerResponseError>
    >((response) => {
      if (!response.ok || response.body.message) {
        const res: DockerResult<{}, DockerKillContainerResponseError> = {
          error: response.error!,
        };
        if (response.status === 404) res.error!.notFound = true;
        if (response.status === 409) res.error!.notRunning = true;
        return res;
      }

      return {
        success: {},
      };
    });
  }

  /**
   * Pulls an image from the registry.
   * To load an image from a URL or tar archive (representing root file system) use the createImage() method.
   * To import an image from a saved container or that has been exported use the importImage() method.
   *
   * @param imageName Name of the image to pull. If the name includes a tag or digest the following behavior applies:
   * - If only fromImage includes a tag, that tag is used.
   * - If both fromImage and tag are provided, tag takes precedence.
   * - If fromImage includes a digest, the image is pulled by digest, and tag is ignored.
   * - If neither a tag nor digest is specified, all tags are pulled.
   * @param options Optional parameters for pulling the image.
   * @returns Empty object on success or an error.
   */
  public async pullImage(
    imageName: string,
    options?: DockerPullImageOptions,
  ): Promise<DockerResult<{}, DockerPullImageResponseError>> {
    const query: { [key: string]: string | string[] } = {};
    query.fromImage = imageName;
    if (options?.platform) query.platform = options.platform;
    if (options?.tag) query.tag = options.tag;

    const headers: { [key: string]: string } = {};
    if (options?.registryAuth) headers['X-Registry-Auth'] = encodeDockerCredentials(options?.registryAuth);

    return this.request('POST', '/images/create', { query, headers }).then<
      DockerResult<{}, DockerCreateImageResponseError>
    >((response) => {
      if (!response.ok) {
        const res: DockerResult<{}, DockerCreateImageResponseError> = {
          error: (response as DockerError).error!,
        };
        if (response.status === 404) res.error!.notFound = true;
        return res;
      }
      return { success: {} };
    });
  }

  /**
   * Restarts a container.
   *
   * @param containerIdOrName ID or name of the container.
   * @param options Optional parameters for restarting the container.
   * @returns Promise resolving to empty object on successful restart or an error.
   */
  public async restartContainer(
    containerIdOrName: string,
    options?: DockerRestartContainerOptions,
  ): Promise<DockerResult<{}, DockerRestartContainerResponseError>> {
    const query: { [key: string]: string } = {};
    if (options?.signal) query.signal = options.signal.toString();
    if (options?.timeout !== undefined) query.t = options.timeout.toString();
    return this.requestJson('POST', '/containers/' + containerIdOrName + '/restart', { query }).then<
      DockerResult<{}, DockerRestartContainerResponseError>
    >((response) => {
      if (!response.ok || response.body.message) {
        const res: DockerResult<{}, DockerRestartContainerResponseError> = {
          error: response.error!,
        };
        if (response.status === 404) res.error!.notFound = true;
        return res;
      }

      return {
        success: {},
      };
    });
  }

  /**
   * Starts a container.
   *
   * @param containerIdOrName ID or name of the container.
   * @param detachKeys Optional key sequence for detaching the container. Single character [a-Z] or ctrl-<value> with <value> being [a-z], '@', '^', ',', '[', or '_'.
   * @returns Promise resolving to empty object on successful start or an error.
   */
  public async startContainer(
    containerIdOrName: string,
    detachKeys?: string,
  ): Promise<DockerResult<{}, DockerStartContainerResponseError>> {
    const query: { [key: string]: string } = {};
    if (detachKeys) query.detachKeys = detachKeys;
    return this.requestJson('POST', '/containers/' + containerIdOrName + '/start', { query }).then<
      DockerResult<{}, DockerStartContainerResponseError>
    >((response) => {
      if (!response.ok || response.body.message) {
        const res: DockerResult<{}, DockerStartContainerResponseError> = {
          error: response.error!,
        };
        if (response.status === 304) res.error!.alreadyStarted = true;
        if (response.status === 404) res.error!.notFound = true;
        return res;
      }

      return {
        success: {},
      };
    });
  }

  /**
   * Stops a running container.
   *
   * @param containerIdOrName ID or name of the container.
   * @param options Optional parameters for stopping the container.
   * @returns Promise resolving to empty object on successful stop or an error.
   */
  public async stopContainer(
    containerIdOrName: string,
    options?: DockerStopContainerOptions,
  ): Promise<DockerResult<{}, DockerStopContainerResponseError>> {
    const query: { [key: string]: string } = {};
    if (options?.signal) query.signal = options.signal.toString();
    if (options?.timeout !== undefined) query.t = options.timeout.toString();
    return this.requestJson('POST', '/containers/' + containerIdOrName + '/stop', { query }).then<
      DockerResult<{}, DockerStopContainerResponseError>
    >((response) => {
      if (!response.ok || response.body.message) {
        const res: DockerResult<{}, DockerStopContainerResponseError> = {
          error: response.error!,
        };
        if (response.status === 304) res.error!.alreadyStopped = true;
        if (response.status === 404) res.error!.notFound = true;
        return res;
      }

      return {
        success: {},
      };
    });
  }
}
export default DockerClient;
