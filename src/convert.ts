import { DockerContainer, DockerContainerBlockIoStatEntry, DockerContainerCpuStats, DockerContainerHealthState, DockerContainerMemoryStats, DockerContainerMountInfo, DockerContainerNetwork, DockerContainerNetworkMode, DockerContainerNetworkStats, DockerContainerStats, DockerContainerStorageStats, DockerCreateContainerOptions } from "./types";


export function encodeCreateContainerOptions(image: string, options?: DockerCreateContainerOptions): string {
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
        if(options.hostConfig.networkMode) body.HostConfig.NetworkMode = encodeDockerContainerNetworkMode(options.hostConfig.networkMode);
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

    return JSON.stringify(body);
}



export function decodeDate(rfc3339Str: string | undefined): Date | undefined {
    if (!rfc3339Str || rfc3339Str === '0001-01-01T00:00:00Z') return undefined;
    const date = new Date(rfc3339Str);
    return isNaN(date.getTime()) ? undefined : date;
}



export function decodeDockerContainer(json: any | undefined): DockerContainer | undefined {
    if (!json) return undefined;

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
            networkMode: decodeDockerContainerNetworkMode(json.HostConfig?.NetworkMode),
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
        mounts: (json.Mounts as any[] || []).map<DockerContainerMountInfo>(mount => decodeDockerContainerMountInfo(mount)!),
        name: json.Names?.[0] || '',
        names: json.Names || [],
        networks: Object.values(json.NetworkSettings?.Networks as object || {}).map<DockerContainerNetwork>(network => decodeDockerContainerNetwork(network)),
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
}



export function decodeDockerContainerBlockIoStatEntries(json: any[] | undefined): DockerContainerBlockIoStatEntry[] | undefined {
    if (!json) return undefined;
    return json.map(entry => ({
        major: entry.major || 0,
        minor: entry.minor || 0,
        op: entry.op || '',
        value: entry.value || 0,
    }));
}



export function decodeDockerContainerCpuStats(json: any | undefined): DockerContainerCpuStats | undefined {
    if(!json) return undefined;
    return {
        cpuUsage: json.cpu_usage ? {
           perCpuUsage: json.cpu_usage.percpu_usage || [],
           totalUsage: json.cpu_usage.total_usage || 0,
           usageInKernelMode: json.cpu_usage.usage_in_kernelmode || 0,
           usageInUserMode: json.cpu_usage.usage_in_usermode || 0,
        } : undefined,
        onlineCpus: json.online_cpus || undefined,
        systemCpuUsage: json.system_cpu_usage || undefined,
        throttlingData: json.throttling_data ? {
            periods: json.throttling_data.periods || 0,
            throttledPeriods: json.throttling_data.throttled_periods || 0,
            throttledTime: json.throttling_data.throttled_time || 0,
        } : undefined,
    };
}



export function decodeDockerContainerMemoryStats(json: any | undefined): DockerContainerMemoryStats | undefined {
    if (!json) return undefined;
    return {
        committedBytes: json.commitbytes || undefined,
        committedBytesPeak: json.commitpeakbytes || undefined,
        failCounter: json.failcnt || undefined,
        maxUsage: json.max_usage || undefined,
        privateWorkingSet: json.privateworkingset || undefined,
        stats: json.stats || {},
        total: json.limit || undefined,
        usage: json.usage || undefined,
    };
}



export function decodeDockerContainerMountInfo(json: any | undefined): DockerContainerMountInfo | undefined {
    if (!json) return undefined;
    return {
        destination: json.Destination || '',
        driver: json.Driver || '',
        mode: json.Mode || '',
        name: json.Name || '',
        propagation: json.Propagation || '',
        source: json.Source || '',
        type: json.Type,
        readOnly: !(json.RW || false),
    };
}



export function decodeDockerContainerNetwork(json: any): DockerContainerNetwork {
    return {
        aliases: json.Aliases || [],
        dnsNames: json.DNSNames || [],
        driverOptions: json.DriverOpts ?? undefined,
        endpointId: json.EndpointID || '',
        gateway: json.Gateway || '',
        gatewayPriority: json.GwPriority || 0,
        ip: json.IPAddress || '',
        ipamConfig: (json.IPAMConfig ? {
            ipv4: json.IPAMConfig.IPv4Address || '',
            ipv6: json.IPAMConfig.IPv6Address || '',
            linkLocalIps: json.IPAMConfig.LinkLocalIPs || [],
        } : undefined),
        ipPrefixLength: json.IPPrefixLen || 0,
        ipv6: json.GlobalIPv6Address || '',
        ipv6Gateway: json.IPv6Gateway || '',
        ipv6PrefixLength: json.GlobalIPv6PrefixLen || 0,
        links: json.Links || [],
        macAddress: json.MacAddress || '',
        networkId: json.NetworkID || '',
    }
}



export function encodeDockerContainerNetworkMode(networkMode: DockerContainerNetworkMode): string {
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

export function decodeDockerContainerNetworkMode(networkMode: string | undefined): DockerContainerNetworkMode {
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



export function decodeDockerContainerNetworkStats(json: any | undefined): DockerContainerNetworkStats | undefined {
    if(!json) return undefined;
    return {
        endpointId: json.endpoint_id || undefined,
        instanceId: json.instance_id || undefined,
        rxBytes: json.rx_bytes || 0,
        rxDropped: json.rx_dropped || 0,
        rxErrors: json.rx_errors || 0,
        rxPackets: json.rx_packets || 0,
        txBytes: json.tx_bytes || 0,
        txDropped: json.tx_dropped || 0,
        txErrors: json.tx_errors || 0,
        txPackets: json.tx_packets || 0,
    };
}



export function decodeDockerContainerStats(json: any | undefined): DockerContainerStats | undefined {
    if(!json) return undefined;
    
    const cpuStats = decodeDockerContainerCpuStats(json.cpu_stats);
    const preStats = decodeDockerContainerCpuStats(json.precpu_stats);
    const memoryStats = decodeDockerContainerMemoryStats(json.memory_stats);

    const cpuCoreCount = Math.max(cpuStats?.cpuUsage?.perCpuUsage?.length || 0, cpuStats?.onlineCpus || 0);
    const cpuDelta = Math.max(0, (cpuStats?.cpuUsage?.totalUsage || 0) - (preStats?.cpuUsage?.totalUsage || 0));
    const memoryTotal = memoryStats?.total;
    const memoryUsed = memoryStats?.usage ? Math.max(0, memoryStats?.usage - (memoryStats?.stats.cache || 0)) : undefined;
    const systemCpuDelta = Math.max(0, (cpuStats?.systemCpuUsage || 0) - (preStats?.systemCpuUsage || 0));

    const cpuUtilization = systemCpuDelta > 0 ? (cpuDelta / systemCpuDelta) * Math.max(1, cpuCoreCount) : 0;
    const memoryUtilization = (memoryTotal && memoryUsed) ? (memoryUsed / memoryTotal) : undefined;
    const networkStats: {[networkInterface: string]: DockerContainerNetworkStats} = {};

    for(const [networkInterface, stats] of Object.entries<any>(json.networks || {})){
        networkStats[networkInterface] = decodeDockerContainerNetworkStats(stats)!;
    }

    return {
        blockIoStats: json.blkio_stats ? {
            ioMergedRecursive: json.io_merged_recursive ? decodeDockerContainerBlockIoStatEntries(json.io_merged_recursive) : undefined,
            ioQueueRecursive: json.io_queue_recursive ? decodeDockerContainerBlockIoStatEntries(json.io_queue_recursive) : undefined,
            ioServiceBytesRecursive: json.io_service_bytes_recursive ? decodeDockerContainerBlockIoStatEntries(json.io_service_bytes_recursive) : undefined,
            ioServicedRecursive: json.io_serviced_recursive ? decodeDockerContainerBlockIoStatEntries(json.io_serviced_recursive) : undefined,
            ioServiceTimeRecursive: json.io_service_time_recursive ? decodeDockerContainerBlockIoStatEntries(json.io_service_time_recursive) : undefined,
            ioTimeRecursive: json.io_time_recursive ? decodeDockerContainerBlockIoStatEntries(json.io_time_recursive) : undefined,
            ioWaitTimeRecursive: json.io_wait_time_recursive ? decodeDockerContainerBlockIoStatEntries(json.io_wait_time_recursive) : undefined,
            sectorsRecursive: json.sectors_recursive ? decodeDockerContainerBlockIoStatEntries(json.sectors_recursive) : undefined,
        } : undefined,
        containerId: json.id || '',
        cpuCoreCount,
        cpuStats,
        cpuUtilization,
        memoryStats: memoryStats!,
        memoryTotal,
        memoryUsed,
        memoryUtilization,
        name: json.name,
        networkStats: json.networks ? networkStats : undefined,
        pidCount: json.pids_stats ? {
            current: json.pids_stats.current || 0,
            limit: json.pids_stats.limit || 0,
        } : undefined,
        previousCpuStats: preStats,
        previousReadDate: decodeDate(json.preread),
        processors: json.num_procs || undefined,
        readDate: decodeDate(json.read) || new Date(),
        storageStats: decodeDockerContainerStorageStats(json.storage_stats) || undefined,
    };
}



export function decodeDockerContainerStorageStats(json: any | undefined): DockerContainerStorageStats | undefined {
    if(!json) return undefined;
    return {
        readCountNormalized: json.read_count_normalized || undefined,
        readSizeBytes: json.read_size_bytes || undefined,
        writeCountNormalized: json.write_count_normalized || undefined,
        writeSizeBytes: json.write_size_bytes || undefined,
    };
}