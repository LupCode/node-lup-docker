import fs from 'fs';
import http from 'http';
import net from 'net';
import { DockerClientOptions, DockerContainer, DockerContainerHealthState, DockerContainerMountInfo, DockerContainerNetwork, DockerContainerNetworkMode, DockerCreateContainerOptions, DockerCreateContainerResponse, DockerCreateContainerResponseDockerError, DockerError, DockerGetContainersOptions, DockerResult } from "./types";







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
     * @param body Optional request body.
     * @returns Response object {
     *  'status': HTTP response code,
     *  'body': Response body string.
     * }.
     */
    public async request(method: 'GET' | 'POST', uri: string, body?: string): Promise<Partial<DockerError> & { status: number, ok: boolean, body: string }> {
        await this.checkReady();

        // fetch
        if(this.mode === 'tcp')
            return fetch(this.origin + uri, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body,
            }).then(async response => {
                const result: Partial<DockerError> & { status: number, ok: boolean, body: string } = {
                    status: response.status,
                    ok: response.ok,
                    body: await response.text(),
                };
                if(!result.ok){
                    result.error = {
                        message: result.body,
                        httpStatus: result.status,
                    };
                    if(result.status === 400) result.error.badRequest = true;
                    if(result.status >= 500) result.error.engineDockerError = true;
                }
                return result;
            });
        
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
                let data = '';
                res.on('data', chunk => {
                    data += chunk;
                });
                res.on('end', () => {
                    const result: Partial<DockerError> & { status: number, ok: boolean, body: string } = {
                        status: res.statusCode || 500,
                        ok: (res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false),
                        body: data,
                    };
                    if(!result.ok){
                        result.error = {
                            message: result.body,
                            httpStatus: result.status,
                        };
                        if(result.status === 400) result.error.badRequest = true;
                        if(result.status >= 500) result.error.engineDockerError = true;
                    }
                    resolve(result);
                });
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
     * @param body Optional request body.
     * @returns Response object {
     *  'status': HTTP response code,
     *  'body': JSON object as type T.
     * }.
     * @template T Return type.
     */
    public async requestJson<T = any>(method: 'GET' | 'POST', uri: string, body?: string): Promise<{ status: number, ok: boolean, body: T }> {
        return this.request(method, uri, body).then(res => ({
            status: res.status,
            ok: res.ok,
            body: JSON.parse(res.body)
        }));
    }



    private encodeContainerNetworkMode(networkMode: DockerContainerNetworkMode): string {
        if(!networkMode || !networkMode.mode) return 'bridge'; // default mode
        if(networkMode.mode === 'container'){
            if(!networkMode.containerIdOrName) throw new Error('Container network mode requires container ID or name');
            return 'container:' + networkMode.containerIdOrName;
        }
        if(networkMode.mode === 'network'){
            if(!networkMode.networkName) throw new Error('Network mode requires network name');
            return 'network:' + networkMode.networkName;
        }
        return networkMode.mode;
    }

    private decodeContainerNetworkMode(networkMode: string | undefined): DockerContainerNetworkMode {
        if(!networkMode) return { mode: 'bridge' }; // default mode
        const [mode, id] = networkMode.split(':');
        if (mode === 'container') {
            return { mode: 'container', containerIdOrName: id };
        }
        if (mode === 'network') {
            return { mode: 'network', networkName: id };
        }
        return { mode: mode as any };
    }





    

    /**
     * Creates a Docker container.
     * 
     * @param image Name or reference of the image to use for creating the container.
     * @param options Options for creating the container.
     * @returns ContainerID and warnings or an error.
     */
    public async createContainer(image: string, options?: DockerCreateContainerOptions): Promise<DockerResult<DockerCreateContainerResponse, DockerCreateContainerResponseDockerError>> {
        const queryArgs: string[] = [];
        if(options?.name) queryArgs.push('name=' + encodeURIComponent(options.name));
        if(options?.platform) queryArgs.push('platform=' + encodeURIComponent(options.platform));

        const body: any = {};
        if(options?.argsEscaped !== undefined) body.ArgsEscaped = options.argsEscaped;
        if(options?.attachStdErr !== undefined) body.AttachStderr = options.attachStdErr;
        if(options?.attachStdIn !== undefined) body.AttachStdin = options.attachStdIn;
        if(options?.attachStdOut !== undefined) body.AttachStdout = options.attachStdOut;
        if(options?.cmd) body.Cmd = options.cmd;
        if(options?.domainName) body.Domainname = options.domainName;
        if(options?.entrypoint !== undefined) body.Entrypoint = options.entrypoint === null ? [''] : options.entrypoint;
        if(options?.env){
            body.Env = [];
            for(const [key, value] of Object.entries(options.env))
                body.Env.push(key + '=' + (value ?? ''));
        }
        if(options?.exposePorts){
            body.ExposedPorts = {};
            options.exposePorts = Array.isArray(options.exposePorts) ? options.exposePorts : [options.exposePorts];
            for(const port of options.exposePorts){
                body.ExposedPorts[port.containerPort+'/'+port.protocol] = {};
            }
        }
        if(options?.healthCheck){
            if(options.healthCheck.test.type === 'arguments' && !options.healthCheck.test.arguments)
                throw new Error('Health check test type "arguments" requires arguments to be specified');
            if(options.healthCheck.test.type === 'command' && !options.healthCheck.test.command)
                throw new Error('Health check test type "command" requires command to be specified');
            body.Healthcheck = {
                Interval: (options.healthCheck.interval || 0) <= 0 ? 0 : Math.max(1000000, (options.healthCheck.interval!) * 1000000000), // sec to ns
                Retries: Math.max(0, options.healthCheck.retries || 0),
                StartInterval: (options.healthCheck.startInterval || 0) <= 0 ? 0 : Math.max(1000000, (options.healthCheck.startInterval!) * 1000000000), // sec to ns
                StartPeriod: (options.healthCheck.startPeriod || 0) <= 0 ? 0 : Math.max(1000000, (options.healthCheck.startPeriod!) * 1000000000), // sec to ns
                Test: (
                    options.healthCheck.test.type === 'arguments' ? ['CMD', ...(options.healthCheck.test.arguments || [])] : 
                    (options.healthCheck.test.type === 'command' ? ['CMD-SHELL', options.healthCheck.test.command || ''] : 
                    (options.healthCheck.test.type === 'inherit' ? [] : 
                    (options.healthCheck.test.type === 'none' ? ['NONE'] : [options.healthCheck.test.type])))
                ),
                Timeout: (options.healthCheck.timeout || 0) <= 0 ? 0 : Math.max(1000000, (options.healthCheck.timeout!) * 1000000000), // sec to ns
            };
        }
        if(options?.hostConfig){
            body.HostConfig = {};
            if(options.hostConfig.annotations) body.HostConfig.Annotations = options.hostConfig.annotations;
            if(options.hostConfig.autoRemove) body.HostConfig.AutoRemove = options.hostConfig.autoRemove;
            if(options.hostConfig.binds) body.HostConfig.Binds = options.hostConfig.binds.map<string>(bind => {
                let str = bind.hostPathOrVolumeName + ':' + bind.containerPath;
                if(bind.options){
                    const options: string[] = [];
                    if(bind.options.noCopy) options.push('nocopy');
                    if(bind.options.propagation) options.push(bind.options.propagation);
                    if(bind.options.readOnly) options.push('ro'); else options.push('rw');
                    if(bind.options.shared !== undefined) options.push(bind.options.shared ? 'z' : 'Z');
                    if(options.length > 0) str += ':' + options.join(',');
                }
                return str;
            });
            if(options.hostConfig.blockIoDeviceReadBps) body.HostConfig.BlkioDeviceReadBps = Object.entries(options.hostConfig.blockIoDeviceReadBps).map(entry => {
                if(typeof entry[1] === 'object') return { Path: entry[0], ...(entry[1] as object) };
                return { Path: entry[0], Rate: entry[1] };
            });
            if(options.hostConfig.blockIoDeviceReadOps) body.HostConfig.BlkioDeviceReadIOps = Object.entries(options.hostConfig.blockIoDeviceReadOps).map(entry => {
                if(typeof entry[1] === 'object') return { Path: entry[0], ...(entry[1] as object) };
                return { Path: entry[0], Rate: entry[1] };
            });
            if(options.hostConfig.blockIoDeviceWeight) body.HostConfig.BlkioWeightDevice = Object.entries(options.hostConfig.blockIoDeviceWeight).map(entry => {
                if(typeof entry[1] === 'object') return { Path: entry[0], ...(entry[1] as object) };
                return { Path: entry[0], Weight: entry[1] };
            });
            if(options.hostConfig.blockIoDeviceWriteBps) body.HostConfig.BlkioDeviceWriteBps = Object.entries(options.hostConfig.blockIoDeviceWriteBps).map(entry => {
                if(typeof entry[1] === 'object') return { Path: entry[0], ...(entry[1] as object) };
                return { Path: entry[0], Rate: entry[1] };
            });
            if(options.hostConfig.blockIoDeviceWriteOps) body.HostConfig.BlkioDeviceWriteIOps = Object.entries(options.hostConfig.blockIoDeviceWriteOps).map(entry => {
                if(typeof entry[1] === 'object') return { Path: entry[0], ...(entry[1] as object) };
                return { Path: entry[0], Rate: entry[1] };
            });
            if(options.hostConfig.blockIoWeight !== undefined) body.HostConfig.BlkioWeight = options.hostConfig.blockIoWeight;
            if(options.hostConfig.cGroup) body.HostConfig.Cgroup = options.hostConfig.cGroup;
            if(options.hostConfig.cGroupNamespaceMode) body.HostConfig.CgroupnsMode = options.hostConfig.cGroupNamespaceMode;
            if(options.hostConfig.cGroupParent) body.HostConfig.CgroupParent = options.hostConfig.cGroupParent;
            if(options.hostConfig.capabilitiesAdd) body.HostConfig.CapAdd = options.hostConfig.capabilitiesAdd;
            if(options.hostConfig.capabilitiesDrop) body.HostConfig.CapDrop = options.hostConfig.capabilitiesDrop;
            if(options.hostConfig.consoleSize) body.HostConfig.ConsoleSize = [
                Math.max(1, options.hostConfig.consoleSize.height || 0), // height
                Math.max(1, options.hostConfig.consoleSize.width || 0)   // width
            ];
            if(options.hostConfig.containerIdFile) body.HostConfig.ContainerIDFile = options.hostConfig.containerIdFile;
            if(options.hostConfig.cpuCount !== undefined) body.HostConfig.CpuCount = options.hostConfig.cpuCount;
            if(options.hostConfig.cpuPercent !== undefined) body.HostConfig.CpuPercent = options.hostConfig.cpuPercent;
            if(options.hostConfig.cpuPeriod !== undefined) body.HostConfig.CpuPeriod = options.hostConfig.cpuPeriod;
            if(options.hostConfig.cpuQuota !== undefined) body.HostConfig.CpuQuota = options.hostConfig.cpuQuota;
            if(options.hostConfig.cpuRealtimePeriod !== undefined) body.HostConfig.CpuRealtimePeriod = options.hostConfig.cpuRealtimePeriod;
            if(options.hostConfig.cpuRealtimeRuntime !== undefined) body.HostConfig.CpuRealtimeRuntime = options.hostConfig.cpuRealtimeRuntime;
            if(options.hostConfig.cpuSetCpus) body.HostConfig.CpuSetCpus = options.hostConfig.cpuSetCpus.map<string>(cpu => cpu.toString()).join(',');
            if(options.hostConfig.cpuSetMemoryNodes) body.HostConfig.CpuSetMems = options.hostConfig.cpuSetMemoryNodes.map<string>(node => node.toString()).join(',');
            if(options.hostConfig.cpuShares !== undefined) body.HostConfig.CpuShares = options.hostConfig.cpuShares;
            if(options.hostConfig.deviceCgroupRules) body.HostConfig.DeviceCgroupRules = options.hostConfig.deviceCgroupRules;
            if(options.hostConfig.deviceRequests) body.HostConfig.DeviceRequests = options.hostConfig.deviceRequests.map(req => ({
                Capabilities: req.capabilities || [],
                Count: req.count || 1,
                DeviceIDs: req.deviceIds || [],
                Driver: req.driver,
                Options: req.options || {},
            }));
            if(options.hostConfig.devices) body.HostConfig.Devices = options.hostConfig.devices.map(device => ({
                CgroupPermissions: device.cGroupPermissions,
                PathInContainer: device.pathInContainer,
                PathOnHost: device.pathOnHost,
            }));
            if(options.hostConfig.dnsOptions) body.HostConfig.DnsOptions = options.hostConfig.dnsOptions;
            if(options.hostConfig.dnsSearch) body.HostConfig.DnsSearch = options.hostConfig.dnsSearch;
            if(options.hostConfig.dnsServers) body.HostConfig.Dns = options.hostConfig.dnsServers;
            if(options.hostConfig.extraHosts) body.HostConfig.ExtraHosts = Object.entries(options.hostConfig.extraHosts).map<string>(entry => entry[0]+':'+entry[1]);
            if(options.hostConfig.groupAdd) body.HostConfig.GroupAdd = options.hostConfig.groupAdd;
            if(options.hostConfig.init !== undefined) body.HostConfig.Init = options.hostConfig.init;
            if(options.hostConfig.ioMaxBps !== undefined) body.HostConfig.IOMaximumBandwidth = options.hostConfig.ioMaxBps;
            if(options.hostConfig.ioMaxOps !== undefined) body.HostConfig.IOMaximumIOps = options.hostConfig.ioMaxOps;
            if(options.hostConfig.ipcMode){
                body.HostConfig.IpcMode = options.hostConfig.ipcMode.mode;
                if(options.hostConfig.ipcMode.mode === 'container'){
                    if(!options.hostConfig.ipcMode.containerIdOrName) throw new Error('Container ID or name must be specified for IPC mode "container"');
                    body.HostConfig.IpcMode = 'container:' + options.hostConfig.ipcMode.containerIdOrName;
                }
            }
            if(options.hostConfig.kernelMemoryTCP !== undefined) body.HostConfig.KernelMemoryTCP = options.hostConfig.kernelMemoryTCP;
            if(options.hostConfig.links) body.HostConfig.Links = options.hostConfig.links.map(link => link.containerName + ':' + link.alias);
            if(options.hostConfig.logging) body.HostConfig.LogConfig = {
                Type: options.hostConfig.logging.type,
                Config: options.hostConfig.logging.config
            };
            if(options.hostConfig.maskedPaths) body.HostConfig.MaskedPaths = options.hostConfig.maskedPaths;
            if(options.hostConfig.memoryLimit !== undefined) body.HostConfig.Memory = options.hostConfig.memoryLimit;
            if(options.hostConfig.memoryReservation !== undefined) body.HostConfig.MemoryReservation = options.hostConfig.memoryReservation;
            if(options.hostConfig.memorySwap !== undefined) body.HostConfig.MemorySwap = options.hostConfig.memorySwap;
            if(options.hostConfig.memorySwappiness !== undefined) body.HostConfig.MemorySwappiness = options.hostConfig.memorySwappiness;
            if(options.hostConfig.mounts) body.HostConfig.Mounts = options.hostConfig.mounts.map(mount => ({
                BindOptions: mount.bindOptions ? {
                    CreateMountpoint: mount.bindOptions.createMountOnHost || false,
                    NonRecursive: mount.bindOptions.nonRecursive || false,
                    Propagation: mount.bindOptions.propagation,
                    ReadOnlyForceRecursive: mount.bindOptions.readOnlyForceRecursive || false,
                    ReadOnlyNonRecursive: mount.bindOptions.readOnlyNonRecursive || false
                } : undefined,
                Consistency: mount.consistency,
                ImageOptions: mount.imageOptions ? {
                    Subpath: mount.imageOptions.subPath || '/',
                } : undefined,
                ReadOnly: mount.readOnly,
                Source: mount.source,
                Target: mount.destination,
                TmpfsOptions: mount.tmpfsOptions ? {
                    Mode: mount.tmpfsOptions.mode,
                    SizeBytes: mount.tmpfsOptions.size,
                    Options: Object.entries(mount.tmpfsOptions.options || {}).map<string[]>(entry => entry[1] ? [entry[0], entry[1]] : [entry[0]]),
                } : undefined,
                Type: mount.type,
                VolumeOptions: mount.volumeOptions ? {
                    DriverConfig: {
                        Name: mount.volumeOptions.driverConfig.name,
                        Options: mount.volumeOptions.driverConfig.options || {},
                    },
                    Labels: mount.volumeOptions.labels || {},
                    NoCopy: mount.volumeOptions.noCopy || false,
                    Subpath: mount.volumeOptions.subPath || '/',
                } : undefined,
            }));
            if(options.hostConfig.nanoCpus !== undefined) body.HostConfig.NanoCpus = options.hostConfig.nanoCpus;
            if(options.hostConfig.networkMode) body.HostConfig.NetworkMode = this.encodeContainerNetworkMode(options.hostConfig.networkMode);
            if(options.hostConfig.outOfMemoryKillDisable !== undefined) body.HostConfig.OomKillDisable = options.hostConfig.outOfMemoryKillDisable;
            if(options.hostConfig.outOfMemoryScore !== undefined) body.HostConfig.OomScoreAdj = options.hostConfig.outOfMemoryScore;
            if(options.hostConfig.pidLimit !== undefined) body.HostConfig.PidsLimit = options.hostConfig.pidLimit;
            if(options.hostConfig.pidMode){
                if(options.hostConfig.pidMode.type === 'container'){
                    if(!options.hostConfig.pidMode.container) throw new Error('PID mode requires container ID or name');
                    body.HostConfig.PidMode = 'container:' + options.hostConfig.pidMode.container;
                } else {
                    body.HostConfig.PidMode = options.hostConfig.pidMode.type || 'host';
                }
            }
            if(options.hostConfig.portBindings){
                const portsObj: {[containerPortProtocol: string] : {HostIp: string, HostPort: string}[]} = {};
                for(const port of options.hostConfig.portBindings){
                    const containerPortProtocol = port.containerPort + '/' + port.protocol;
                    portsObj[containerPortProtocol] = portsObj[containerPortProtocol] || [];
                    portsObj[containerPortProtocol].push({ HostIp: port.hostAddress || '0.0.0.0', HostPort: port.hostPort+'' });
                }
                body.HostConfig.PortBindings = portsObj;
            }
            if(options.hostConfig.privileged !== undefined) body.HostConfig.Privileged = options.hostConfig.privileged;
            if(options.hostConfig.publishAllPorts !== undefined) body.HostConfig.PublishAllPorts = options.hostConfig.publishAllPorts;
            if(options.hostConfig.readOnlyPaths) body.HostConfig.ReadonlyPaths = options.hostConfig.readOnlyPaths;
            if(options.hostConfig.restart) body.HostConfig.RestartPolicy = {
                MaximumRetryCount: options.hostConfig.restart.maximumRetryCount,
                Name: options.hostConfig.restart.name || ''
            };
            if(options.hostConfig.rootFsReadOnly !== undefined) body.HostConfig.ReadonlyRootfs = options.hostConfig.rootFsReadOnly;
            if(options.hostConfig.runtime) body.HostConfig.Runtime = options.hostConfig.runtime;
            if(options.hostConfig.securityOptions) body.HostConfig.SecurityOpt = options.hostConfig.securityOptions;
            if(options.hostConfig.shmSize !== undefined) body.HostConfig.ShmSize = options.hostConfig.shmSize;
            if(options.hostConfig.storageOptions) body.HostConfig.StorageOpt = options.hostConfig.storageOptions;
            if(options.hostConfig.sysctls) body.HostConfig.Sysctls = options.hostConfig.sysctls;
            if(options.hostConfig.tmpfs){
                const tmpfsObj: {[path: string]: string} = {};
                for(const tmpfs of options.hostConfig.tmpfs){
                    const args: string[] = [];
                    if(tmpfs.deviceFile === 'create-only') args.push('nodev'); else
                    if(tmpfs.deviceFile === 'yes') args.push('dev');
                    if(tmpfs.gid) args.push('gid=' + tmpfs.gid);
                    if(tmpfs.maxBlocks) args.push('nr_blocks=' + tmpfs.maxBlocks);
                    if(tmpfs.maxInodes) args.push('nr_inodes=' + tmpfs.maxInodes);
                    if(tmpfs.mode) args.push('mode=' + tmpfs.mode);
                    if(tmpfs.noAccessTime !== undefined) args.push(tmpfs.noAccessTime ? 'noatime' : 'atime');
                    if(tmpfs.noDirAccessTime !== undefined) args.push(tmpfs.noDirAccessTime ? 'nodiratime' : 'diratime');
                    if(tmpfs.noExecute !== undefined) args.push(tmpfs.noExecute ? 'noexec' : 'exec');
                    if(tmpfs.noSetUid !== undefined) args.push(tmpfs.noSetUid ? 'nosuid' : 'suid');
                    if(tmpfs.readOnly !== undefined) args.push(tmpfs.readOnly ? 'ro' : 'rw');
                    if(tmpfs.size) args.push('size=' + tmpfs.size);
                    if(tmpfs.syncDir) args.push('dirsync');
                    if(tmpfs.syncIO) args.push(tmpfs.syncIO ? 'sync' : 'async');
                    if(tmpfs.uid) args.push('uid=' + tmpfs.uid);
                    tmpfsObj[tmpfs.mountPath] = args.join(',');
                }
                body.HostConfig.Tmpfs = tmpfsObj;
            }
            if(options.hostConfig.uLimits) body.HostConfig.Ulimits = options.hostConfig.uLimits.map(ulimit => ({
                Hard: ulimit.hard,
                Name: ulimit.name,
                Soft: ulimit.soft
            }));
            if(options.hostConfig.userNameSpaceMode) body.HostConfig.UsernsMode = options.hostConfig.userNameSpaceMode;
            if(options.hostConfig.utsMode) body.HostConfig.UTSMode = options.hostConfig.utsMode;
            if(options.hostConfig.volumeDriver) body.HostConfig.VolumeDriver = options.hostConfig.volumeDriver;
            if(options.hostConfig.volumesInheritFrom) body.HostConfig.VolumesFrom = options.hostConfig.volumesInheritFrom.map<string>(volume => {
                return volume.containerName + ':' + (volume.readOnly ? 'ro' : 'rw');
            });
            if(options.hostConfig.windowsIsolation) body.HostConfig.Isolation = options.hostConfig.windowsIsolation;
        }
        if(options?.hostname) body.Hostname = options.hostname;
        // as individual argument if(options?.image) body.Image = options.image;
        body.Image = image;
        if(options?.labels) body.Labels = options.labels;
        // in query: if(options?.name) body.Name = options.name;
        if(options?.networkDisabled !== undefined) body.NetworkDisabled = options.networkDisabled;
        if(options?.networkEndpoints){
            const EndpointsConfig = {} as any;
            for(const [key, obj] of Object.entries(options.networkEndpoints)){
                EndpointsConfig[key] = {
                    Aliases: obj.aliases,
                    DNSNames: obj.dnsNames,
                    DriverOpts: obj.driverOptions,
                    EndpointID: obj.endpointId,
                    Gateway: obj.gateway,
                    GlobalIPv6Address: obj.ipv6,
                    GlobalIPv6PrefixLen: obj.ipv6PrefixLength,
                    GwPriority: obj.gatewayPriority,
                    IPAddress: obj.ip,
                    IPAMConfig: obj.ipamConfig ? {
                        IPv4Address: obj.ipamConfig.ipv4,
                        IPv6Address: obj.ipamConfig.ipv6,
                        LinkLocalIPs: obj.ipamConfig.linkLocalIps,
                    } : undefined,
                    IPPrefixLen: obj.ipPrefixLength,
                    IPv6Gateway: obj.ipv6Gateway,
                    Links: obj.links,
                    MacAddress: obj.macAddress,
                    NetworkID: obj.networkId,
                };
            }
            body.NetworkingConfig = { EndpointsConfig };
        }
        if(options?.onBuild !== undefined) body.OnBuild = options.onBuild;
        if(options?.openStdIn !== undefined) body.OpenStdin = options.openStdIn;
        // in query: if(options?.platform) body.Platform = options.platform;
        if(options?.shell) body.Shell = Array.isArray(options.shell) ? options.shell : [options.shell];
        if(options?.stdInOnce !== undefined) body.StdinOnce = options.stdInOnce;
        if(options?.stopSignal !== undefined) body.StopSignal = options.stopSignal+'';
        if(options?.stopTimeout !== undefined) body.StopTimeout = options.stopTimeout;
        if(options?.tty !== undefined) body.Tty = options.tty;
        if(options?.user) body.User = options.user;
        if(options?.volumes){
            const volumesObj: {[mountPointPaths: string]: {}} = {};
            for(const volume of options.volumes)
                volumesObj[volume] = {};
            body.Volumes = volumesObj;
        }
        if(options?.workingDir) body.WorkingDir = options.workingDir;

        return this.requestJson('POST', '/containers/create' + (queryArgs.length ? '?' + queryArgs.join('&') : ''), JSON.stringify(body)).then<DockerResult<DockerCreateContainerResponse, DockerCreateContainerResponseDockerError>>(response => {
            if(!response.ok || response.body.message){
                const res: DockerResult<DockerCreateContainerResponse, DockerCreateContainerResponseDockerError> = {
                    error: {
                        message: response.body.message,
                        httpStatus: response.status,
                    }
                };
                if(response.status === 400) res.error!.badRequest = true;
                if(response.status === 404) res.error!.imageNotFound = true;
                if(response.status === 409) res.error!.conflictingContainerName = true;
                if(response.status >= 500) res.error!.engineDockerError = true;
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
     * Returns a list of containers.
     * 
     * @param options Optional options for querying containers.
     * @returns List of containers or an error.
     */
    public async getContainers(options?: DockerGetContainersOptions): Promise<DockerResult<DockerContainer[]>> {
        const queryArgs: string[] = [];
        if(options?.all) queryArgs.push('all=true');
        if(options?.limit) queryArgs.push('limit=' + options.limit);
        if(options?.size) queryArgs.push('size=true');
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
            if(Object.keys(json).length > 0) queryArgs.push('filters=' + JSON.stringify(json));
        }

        return this.requestJson('GET', '/containers/json' + (queryArgs.length > 0 ? '?' + queryArgs.join('&') : '')).then<DockerResult<DockerContainer[]>>(response => {
            if(!response.ok || response.body.message){
                const result: DockerResult<DockerContainer[]> = {
                    error: {
                        message: response.body.message || 'Failed to retrieve containers',
                        httpStatus: response.status,
                    }
                };
                if(response.status === 400) result.error!.badRequest = true;
                if(response.status >= 500) result.error!.engineDockerError = true;
                return result;
            }
            return {
                success: (response.body as any[]).map<DockerContainer>(json => {
                    let healthState: DockerContainerHealthState | undefined = undefined;
                    if(json.Status.includes('healthy')){
                        healthState = 'healthy';
                    } else if(json.Status.includes('unhealthy')){
                        healthState = 'unhealthy';
                    } else if(json.Status.includes('starting')){
                        healthState = 'starting';
                    }

                    return {
                        cmd: json.Command,
                        containerId: json.Id,
                        createdAt: new Date(json.Created * 1000),
                        healthState,
                        hostConfig: {
                            annotations: json.HostConfig?.annotations || {},
                            networkMode: this.decodeContainerNetworkMode(json.HostConfig?.NetworkMode),
                        },
                        imageId: json.ImageID,
                        imageName: json.Image,
                        imageMetadata: {
                            annotations: json.ImageManifestDescriptor?.annotations || {},
                            artifactType: json.ImageManifestDescriptor?.artifactType ?? undefined,
                            data: (json.ImageManifestDescriptor?.data ? Buffer.from(json.ImageManifestDescriptor.data, 'base64') : undefined),
                            digest: json.ImageManifestDescriptor?.digest || '',
                            mediaType: json.ImageManifestDescriptor?.mediaType || '',
                            platform: (json.ImageManifestDescriptor?.platform ? {
                                architecture: json.ImageManifestDescriptor.platform.architecture || '',
                                os: json.ImageManifestDescriptor.platform.os || '',
                                osFeatures: json.ImageManifestDescriptor.platform['os.features'] || [],
                                osVersion: json.ImageManifestDescriptor.platform['os.version'],
                                variant: json.ImageManifestDescriptor.platform.variant
                            } : undefined),
                            size: json.ImageManifestDescriptor?.size || 0,
                            urls: json.ImageManifestDescriptor?.urls || [],
                        },
                        isHealthy: (json.State === 'running' && healthState !== 'unhealthy'),
                        isRunning: json.State === 'running',
                        labels: json.Labels || {},
                        mounts: (json.Mounts as any[] || []).map<DockerContainerMountInfo>(mount => ({
                            destination: mount.Destination || '',
                            driver: mount.Driver || '',
                            mode: mount.Mode || '',
                            name: mount.Name || '',
                            propagation: mount.Propagation || '',
                            source: mount.Source || '',
                            type: mount.Type,
                            readOnly: !(mount.RW || false),
                        })),
                        name: json.Names?.[0] || '',
                        names: json.Names || [],
                        networks: Object.values(json.NetworkSettings?.Networks as object || {}).map<DockerContainerNetwork>(network => ({
                            aliases: network.Aliases || [],
                            dnsNames: network.DNSNames || [],
                            driverOptions: network.DriverOpts ?? undefined,
                            endpointId: network.EndpointID || '',
                            gateway: network.Gateway || '',
                            gatewayPriority: network.GwPriority || 0,
                            ip: network.IPAddress || '',
                            ipamConfig: (network.IPAMConfig ? {
                                ipv4: network.IPAMConfig.IPv4Address || '',
                                ipv6: network.IPAMConfig.IPv6Address || '',
                                linkLocalIps: network.IPAMConfig.LinkLocalIPs || [],
                            } : undefined),
                            ipPrefixLength: network.IPPrefixLen || 0,
                            ipv6: network.GlobalIPv6Address || '',
                            ipv6Gateway: network.IPv6Gateway || '',
                            ipv6PrefixLength: network.GlobalIPv6PrefixLen || 0,
                            links: network.Links || [],
                            macAddress: network.MacAddress || '',
                            networkId: network.NetworkID || '',
                        })),
                        ports: (json.Ports as any[] || []).map(port => ({
                            containerPort: port.PrivatePort || 0,
                            hostAddress: port.IP,
                            hostPort: port.PublicPort || 0,
                            protocol: port.Type || 'tcp',
                        })),
                        state: json.State || 'created',
                        statusMessage: json.Status || '',
                        sizeChangedFiles: json.SizeRw,
                        sizeImage: json.SizeRootFs,
                    };
                }),
            };
        });
    }

}
export default DockerClient;