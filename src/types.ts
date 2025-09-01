import { DockerLogStream, DockerLogStreamCallback, DockerStatsStream } from './stream';

export type DockerSuccess<T> = {
  /** Object containing the successful response data. */
  success?: T;
};

export type DockerError<T extends object = {}> = {
  /** Object containing the error response data. */
  error?: {
    /** DockerError message (always present in case of an error). */
    message: string;

    /** HTTP status code (always present in case of an error). */
    httpStatus: number;

    /** If some option is invalid. */
    badRequest?: boolean;

    /** If the container engine reported an error. */
    engineDockerError?: boolean;
  } & T;
};

export type DockerResult<S = {}, E extends object = {}> = DockerSuccess<S> & DockerError<E>;

export type DockerBind = {
  /** Path in the container where the file or directory will be mounted */
  containerPath: string;

  /** Path on the host to the file or directory to bind mount or volume name */
  hostPathOrVolumeName: string;

  /**
   * Options for the bind mount.
   */
  options?: {
    /** Disables automatic copying of data from the container path to the volume (only applies to named volumes). */
    noCopy?: boolean;

    /** Mounts a volume read-only. If not set, the volume is mounted read-write. */
    readOnly?: boolean;

    /**
     * Applies SELinux labels:
     * - true: Shared content label is applied to the content ('z'). It indicates that multiple containers can share the volume for read-write.
     * - false: Private unshared content label is applied to the content ('Z'). It indicates that the volume is private and cannot be shared.
     * - undefined: No content label is applied to the content.
     *
     * If SELinux labels are used, the content of the mounted volume should be labeled accordingly, otherwise the security system may deny access.
     */
    shared?: boolean;

    /**
     * Specifies the mount propagation mode (only applies to bind-mounted volumes, not internal or named volumes).
     * Requires the source directory in the host to have the correct propagation properties.
     */
    propagation?: DockerBindPropagation;
  };
};

/**
 * Mount propagation mode.
 * - 'private': Mounts are private to the container and are not shared with other containers.
 * - 'rprivate': Mounts are private to the container and are not shared with other containers (read-only).
 * - 'rshared': Mounts are shared with other containers and can be used by multiple containers (source must also be 'shared', read-only).
 * - 'rslave': Mounts are shared with other containers, but changes are not propagated back to the host (source must be 'shared' or 'slave', read-only).
 * - 'shared': Mounts are shared with other containers and can be used by multiple containers (source must also be 'shared').
 * - 'slave': Mounts are shared with other containers, but changes are not propagated back to the host (source must be 'shared' or 'slave').
 */
export type DockerBindPropagation = 'private' | 'rprivate' | 'rshared' | 'rslave' | 'shared' | 'slave';

export type DockerClientOptions = {
  /**
   * True to use the unix socket at /var/run/docker.sock
   * or a custom socket path.
   */
  unixSocket?: boolean | string;

  /**
   * True to use the Windows named pipe at //./pipe/docker_engine
   * or a custom pipe path.
   */
  windowsPipe?: boolean | string;

  /**
   * Remote Docker host configuration.
   */
  remote?: {
    /** Hostname or IP address of the remote Docker host (default localhost). */
    host?: string;

    /** Port number of the remote Docker host (default 2375). */
    port?: number;

    /** If TLS should be used (default false). */
    tls?: boolean;
  };
};

export type DockerContainer = {
  /** Command running in the container. */
  cmd: string;

  /** ID of the container. */
  containerId: string;

  /** Date when the container was created. */
  createdAt: Date;

  /** Host configuration for the container. */
  hostConfig: DockerHostConfigNetwork;

  /** ID of the image used by the container. */
  imageId: string;

  /** Name of the image used by the container. */
  imageName: string;

  /** Metadata of the image */
  imageMetadata: DockerOCIDescriptor;

  /** Labels assigned to the container. */
  labels: { [key: string]: string };

  /** Mounts for the container (e.g. files and directories accessible of the host accessible inside the container). */
  mounts: DockerContainerMountInfo[];

  /** Name of the container (first name if multiple). */
  name: string;

  /** All names of the container. */
  names: string[];

  /** Networks the container is attached to. */
  networks: DockerContainerNetwork[];

  /** Exposed ports for network traffic. */
  ports: DockerPortMapping[];

  /**
   * Disk size the container utilized in bytes (includes image layers that might be shared with other images).
   * Field only present if option size has been set.
   */
  sizeImage?: number;

  /**
   * Disk size of the files that the container created or has changed in bytes.
   * Field only present if option size has been set.
   */
  sizeChangedFiles?: number;

  /**
   * State of the container. Possible values are:
   * - 'created': The container has been created but not started.
   * - 'restarting': The container is restarting.
   * - 'running': The container is currently running.
   * - 'removing': The container is being removed.
   * - 'paused': The container is paused.
   * - 'exited': The container has exited.
   * - 'dead': The container is dead and cannot be restarted.
   */
  state: DockerContainerState;

  /** Human-readable string describing the current status of the container. */
  statusMessage: string;

  /** Health state of the container if available. */
  healthState?: DockerContainerHealthState;

  /** Whether the container is healthy or not (false if container is running and explicitly unhealthy). */
  isHealthy: boolean;

  /** Whether the container is currently running. */
  isRunning: boolean;
};

export type DockerContainerBlockIoStatEntry = {
  major: number;

  minor: number;

  op: string;

  value: number;
};

export type DockerContainerCpuStats = {
  /** All CPU stats aggregated since container inception. */
  cpuUsage?: {
    /** Total CPU time (in nanoseconds) consumed per core (Linux only if cgroups v1). */
    perCpuUsage: number[];

    /** Total CPU time consumed in nanoseconds (Linux) or 100's of nanoseconds (Windows). */
    totalUsage: number;

    /**
     * Time (in nanoseconds) spent by tasks of the cgroup in kernel mode (Linux),
     * or time spend (in 100's of nanoseconds) by all container processes in kernel mode (Windows).
     * Not populated for Windows containers using Hyper-V isolation.
     */
    usageInKernelMode?: number;

    /**
     * Time (in nanoseconds) spent by tasks of the cgroup in user mode (Linux),
     * or time spent (in 100's of nanoseconds) by all container processes in user mode (Windows).
     * Not populated for Windows containers using Hyper-V isolation.
     */
    usageInUserMode?: number;
  };

  /** Number of online CPUs (Linux only). */
  onlineCpus: number;

  /** System usage (Linux only). */
  systemCpuUsage?: number;

  /** CPU throttling stats of the container (Linux only). */
  throttlingData?: {
    /** Number of periods with throttling active. */
    periods: number;

    /** Number of periods when the container hit its throttling limit. */
    throttledPeriods: number;

    /** Aggregated time (in nanoseconds) the container was throttled for. */
    throttledTime: number;
  };
};

export type DockerContainerHealthState = 'starting' | 'healthy' | 'unhealthy';

export type DockerContainerInheritedVolume = {
  /** Name of the container the volumes are inherited from. */
  containerName: string;

  /** If the volumes are read-only. */
  readOnly: boolean;
};

export type DockerContainerLink = {
  /** Name of the container to link to. */
  containerName: string;

  /** Alias for the container link under which the container is accessible. */
  alias: string;
};

export type DockerContainerMemoryStats = {
  /** Committed bytes to the container in bytes (Windows only). */
  committedBytes?: number;

  /** Peak committed bytes to the container in bytes (Windows only). */
  committedBytesPeak?: number;

  /** Number of times memory usage hits limits (Linux only and only for cgroups v1). */
  failCounter?: number;

  /** Maximum usage ever recorded in bytes (Linux only and only for cgroups v1). */
  maxUsage?: number;

  /** Private working set (Windows only). */
  privateWorkingSet?: number;

  /** All stats exposed via memory.stat when using cgroups v2. */
  stats: { [key: string]: number };

  /** Total memory available to the container in bytes (Linux only). */
  total?: number;

  /** Memory usage in bytes (Linux only). */
  usage?: number;
};

// private base class
type DockerContainerMountBase = {
  /** Destination path relative to the container root where the source is mounted inside the container. */
  destination: string;

  /** If the mount is read-only. */
  readOnly: boolean;

  /**
   * Source location of the mount.
   * For volumes this contains the storage location of the volume.
   * For bind-mounts and npipe this contains the source (host) part.
   * For tmpfs mounts this field is empty.
   */
  source: string;

  /** Type of mount into the container. */
  type: DockerMountType;
};

export type DockerContainerMountCreate = DockerContainerMountBase & {
  /** Additional options if type is 'bind'. */
  bindOptions?: {
    /** Creates the mount point on the host if missing (default false). */
    createMountOnHost?: boolean;

    /** Disable recursive bind mound (default false). */
    nonRecursive?: boolean;

    /** Propagation mode. */
    propagation: DockerBindPropagation;

    /** Raise error if mount cannot be made recursively read-only (default false). */
    readOnlyForceRecursive?: boolean;

    /** Make mount non-recursively read-only, but still leave the mount recursive (unless nonRecursive is set, defaullt false). */
    readOnlyNonRecursive?: boolean;
  };

  /** Consistency requirement for the mount:
   * - 'consistent': Mounts are consistent and changes are propagated to the host.
   * - 'default': Mounts use the default consistency mode.
   * - 'delegated': Mounts are delegated and changes are not propagated to the host.
   * - 'cached': Mounts are cached and changes are not propagated to the host.
   */
  consistency: 'consistent' | 'default' | 'delegated' | 'cached';

  /** Additional options if type is 'image'. */
  imageOptions?: {
    /** Source path within the image (must be relative without any back traversals '..'). */
    subPath?: string;
  };

  /** Additional options if type is 'tmpfs'. */
  tmpfsOptions?: {
    /** Permission mode for the tmpfs mount in an integer. */
    mode: number;

    /** Mount options for the tmpfs. */
    options?: { [key: string]: string | null };

    /** Size of the tmpfs mount in bytes. */
    size: number;
  };

  /** Additional options if type is 'volume'. */
  volumeOptions?: {
    /** Driver specific options. */
    driverConfig: {
      /** Name of the driver to use to create the volume. */
      name: string;

      /** Options specific to the driver. */
      options: { [key: string]: string };
    };

    /** Labels to assign to the volume. */
    labels?: { [key: string]: string };

    /** Populate volume with data from the target (default false). */
    noCopy?: boolean;

    /** Source path within the volume (must be relative without any back traversals '..'). */
    subPath?: string;
  };
};

export type DockerContainerMountInfo = DockerContainerMountBase & {
  /** Volume driver used to create the volume (if it is a volume.) */
  driver: string;

  /** Comma separated list of options supplied by the user when creating the bind/volume. (default: 'z' on Linux, '' on Windows). */
  mode: string;

  /** Name of the underlying data (e.g. if type is 'volume' or 'image' then the name of the volume/image). */
  name: string;

  /** Describes how mounts are propagated from the host into the container, see Linux kernel documentation. Empty on Windows. */
  propagation: DockerBindPropagation;
};

export type DockerContainerNetwork = {
  /** Aliases for the container in the network. */
  aliases: string[];

  /** All DNS names that resolve to this container. */
  dnsNames: string[];

  /** Options for the network driver. */
  driverOptions?: { [key: string]: string };

  /** ID for the service endpoint in a sandbox. */
  endpointId: string;

  /** Gateway address for this network. */
  gateway: string;

  /**
   * Gateway with the highest priority will be the default gateway.
   * If two gateways have the same priority, the one that comes lexicographically first will be used.
   */
  gatewayPriority: number;

  /** IPv4 address of the container. */
  ip: string;

  /** IPAM endpoint config of the container. */
  ipamConfig?: {
    ipv4: string;
    ipv6: string;
    linkLocalIps: string[];
  };

  /** Mask length of the IPv4 address. */
  ipPrefixLength: number;

  /** Global IPv6 address. */
  ipv6: string;

  /** IPv6 gateway address for this network. */
  ipv6Gateway: string;

  /** Mask length of the global IPv6 address. */
  ipv6PrefixLength: number;

  /** Names of the containers that this container can reach through the network. */
  links: string[];

  /** MAC address of the container. */
  macAddress: string;

  /** ID of the network. */
  networkId: string;
};

export type DockerContainerNetworkMode = {
  /** If mode is 'container', this specifies the container to use as the network stack. */
  containerIdOrName?: string;

  /**
   * Network mode to use for the container.
   * - 'bridge': Use the default bridge network.
   * - 'container': Use another container's network stack (specify container ID or name using `containerIdOrName`).
   * - 'host': Use the host network stack.
   * - 'network': Use a user-defined network (specify network name using `networkName`).
   * - 'none': Disable networking.
   */
  mode: 'bridge' | 'container' | 'host' | 'network' | 'none';

  /** If mode is 'network', this specifies the name of the network to use. */
  networkName?: string;
};

export type DockerContainerNetworkStats = {
  /** ID of the endpoint (Windows only). */
  endpointId?: string;

  /** ID of the instance (Windows only). */
  instanceId?: string;

  /** Bytes received. */
  rxBytes: number;

  /** Dropped incoming packets. */
  rxDropped: number;

  /** Errors received (Linux only). */
  rxErrors: number;

  /** Packets received. */
  rxPackets: number;

  /** Bytes sent. */
  txBytes: number;

  /** Dropped outgoing packets. */
  txDropped: number;

  /** Sent errors (Linux only). */
  txErrors: number;

  /** Packets sent. */
  txPackets: number;
};

export type DockerContainerPidMode = {
  /** If mode is 'container' then the name or id of the container to join the PID namespace. */
  container?: string;

  /**
   * PID mode for the container:
   * - 'container': join the PID namespace of the specified container.
   * - 'host': use host system PID namespace.
   */
  type?: 'container' | 'host';
};

/**
 * State of a container. Possible values are:
 * - 'created': The container has been created but not started.
 * - 'restarting': The container is restarting.
 * - 'running': The container is currently running.
 * - 'removing': The container is being removed.
 * - 'paused': The container is paused.
 * - 'exited': The container has exited.
 * - 'dead': The container is dead and cannot be restarted.
 */
export type DockerContainerState = 'created' | 'restarting' | 'running' | 'removing' | 'paused' | 'exited' | 'dead';

export type DockerContainerStats = {
  /** All IO service stats for data reads and writes (Linux only). */
  blockIoStats?: {
    /** Only available when using Linux containers with cgroups v1. */
    ioMergedRecursive?: DockerContainerBlockIoStatEntry[];

    /** Only available when using Linux containers with cgroups v1. */
    ioQueueRecursive?: DockerContainerBlockIoStatEntry[];

    ioServiceBytesRecursive?: DockerContainerBlockIoStatEntry[];

    /** Only available when using Linux containers with cgroups v1. */
    ioServicedRecursive?: DockerContainerBlockIoStatEntry[];

    /** Only available when using Linux containers with cgroups v1. */
    ioServiceTimeRecursive?: DockerContainerBlockIoStatEntry[];

    /** Only available when using Linux containers with cgroups v1. */
    ioTimeRecursive?: DockerContainerBlockIoStatEntry[];

    /** Only available when using Linux containers with cgroups v1. */
    ioWaitTimeRecursive?: DockerContainerBlockIoStatEntry[];

    /** Only available when using Linux containers with cgroups v1. */
    sectorsRecursive?: DockerContainerBlockIoStatEntry[];
  };

  /** ID of the container. */
  containerId?: string;

  /** Number of CPU cores allocated to the container. */
  cpuCoreCount?: number;

  /** CPU related info of the container. */
  cpuStats?: DockerContainerCpuStats;

  /** CPU utilization of the container in percentage 0.0-1.0. */
  cpuUtilization?: number;

  /**
   * Aggregates all memory stats since container inceptions on Linux.
   * Windows returns stats for commit and private working set only.
   */
  memoryStats: DockerContainerMemoryStats;

  /** Total memory limit of the container. */
  memoryTotal?: number;

  /** Used memory in bytes. */
  memoryUsed?: number;

  /** Memory utilization of the container in percentage 0.0-1.0. */
  memoryUtilization?: number;

  /** Name of the container. */
  name?: string;

  /** Network statistics per container interface. */
  networkStats?: { [networkInterface: string]: DockerContainerNetworkStats };

  /** Number and limit of PIDs in the cgroup (Linux only). */
  pidCount?: {
    /** Number of PIDs in the cgroup. */
    current: number;

    /** Hard limit on the number of pids in the cgroup. If zero then no limit is enforced. */
    limit: number;
  };

  /** CPU stats of the previous read which is used to compute to calculate the CPU usage percentage (Linux only). */
  previousCpuStats?: DockerContainerCpuStats;

  /** Timestamp at which the first sample was collected (not present if 'oneShot' option is true) */
  previousReadDate?: Date;

  /** Number of processors on the system (Windows only). */
  processors?: number;

  /** Timestamp at which this sample was collected. */
  readDate: Date;

  /** Disk I/O stats for read and write (Windows only). */
  storageStats?: DockerContainerStorageStats;
};

export type DockerContainerStorageStats = {
  readCountNormalized?: number;

  readSizeBytes?: number;

  writeCountNormalized?: number;

  writeSizeBytes: number;
};

export type DockerCreateContainerOptions = {
  /** Whether the command is already escaped (Windows only, default false). */
  argsEscaped?: boolean;

  /** Whether the stderr should be attached (default true). */
  attachStdErr?: boolean;

  /** Whether the stdin should be attached (default false). */
  attachStdIn?: boolean;

  /** Whether the stdout should be attached (default true). */
  attachStdOut?: boolean;

  /**
   * Command to run on startup inside the container.
   * Either entire command as one string or each argument as a separate string (string[])
   */
  cmd?: string | string[];

  /** Domain name to use for the container. */
  domainName?: string;

  /**
   * Entrypoint command either as string or the individual arguments as string array.
   * If null no entrypoint will be set.
   * If undefined, the entrypoint will be inherited from the image.
   */
  entrypoint?: string | string[] | null;

  /**
   * Environment variables to set in the container.
   * If the value is null or undefined, the environment variable will be removed.
   */
  env?: { [key: string]: string | null | undefined };

  /** Container ports to expose to the network. */
  exposePorts?: DockerExposePort | DockerExposePort[];

  /** Health check configuration for the container. If not set the configuration of the image is used. */
  healthCheck?: DockerHealthCheck;

  /** Host configuration options for the container. */
  hostConfig?: DockerHostConfig;

  /** Hostname to use for the container (RFC 1123). */
  hostname?: string;

  /** User defined key/value metadata. */
  labels?: { [key: string]: string };

  /** Name the container should have (/?[a-zA-Z0-9][a-zA-Z0-9_.-]+). */
  name?: string;

  /** Whether networking for the container should be disabled. */
  networkDisabled?: boolean;

  /** Mapping of network name to endpoint configuration for that network. */
  networkEndpoints?: { [networkName: string]: DockerContainerNetwork };

  /** ONBUILD metadata that were defined in the image's Dockerfile. */
  onBuild?: string[];

  /** Whether if the stdin should be opened. */
  openStdIn?: boolean;

  /** Platform in the format <os>[/<arch>[/<variant>]] used to lookup the image. */
  platform?: string;

  /** Shell to use when building the container image, for the entrypoint, and for the start command. */
  shell?: string | string[];

  /** Close stdin after one attached client disconnects. */
  stdInOnce?: boolean;

  /** Signal to stop the container. */
  stopSignal?: number | string;

  /** Timeout duration in seconds to stop the container (default: 10). */
  stopTimeout?: number;

  /** Whether standard streams should be attached to a TTY, including stdin if not closed. */
  tty?: boolean;

  /** Commands inside the container are run as the given user otherwise the user specified by the image is used. Format <userNameOrUID>[:<groupNameOrGID>]. */
  user?: string;

  /** List of paths inside the container that should be stored in volumes. */
  volumes?: string | string[];

  /** Working directory inside the container to run the commands in. */
  workingDir?: string;
};

export type DockerCreateContainerResponse = {
  /** ID of the container. */
  containerId?: string;

  /** List of warnings encountered during container creation. */
  warnings: string[];
};

export type DockerCreateContainerResponseDockerError = {
  /** If the image is not found. */
  imageNotFound?: boolean;

  /** If the container name is already in use. */
  conflictingContainerName?: boolean;
};

export type DockerCreateImageOptions = {
  /** Dockerfile style commands to apply to the image. */
  changes?: string[];

  /** Commit message to include with the import. */
  message?: string;

  /** Repository name given to the image which may include a tag. */
  name?: string;

  /** Platform to import the image for. */
  platform?: string;

  /** Authentication credentials for the Docker registry. */
  registryAuth?: DockerCredentials | DockerIdentityToken;

  /** Tag to apply to the image. */
  tag?: string;
};
export type DockerCreateImageResponseError = {
  /** If the source URL is invalid or missing. */
  notFound?: boolean;
};

export type DockerCredentials = {
  /** Email address of the user account. */
  email: string;

  /** Password for the user account. */
  password: string;

  /** Server address of the Docker registry in form of a domain/IP without a protocol. */
  serverAddress: string;

  /** Username for the user account. */
  username: string;
};

export type DockerDeleteContainerOptions = {
  /** Kill the container in case it is running (default false). */
  force?: boolean;

  /** Delete the link associated with the container (default false). */
  link?: boolean;

  /** Delete anonymous volumes associated with the container (default false). */
  volumes?: boolean;
};
export type DockerDeleteContainerResponseError = {
  /** If the container is still running and therefore cannot be deleted. */
  stillRunning?: boolean;

  /** If no container with the given ID or name was not found. */
  notFound?: boolean;
};

export type DockerDevice = {
  /** Path in the container under which the device should be accessible. */
  pathInContainer: string;

  /** Path on the host to the device that should be accessible inside the container. */
  pathOnHost: string;

  /** cgroup permissions for the device. */
  cGroupPermissions: string;
};

export type DockerDeviceRequest = {
  /** OR list of AND lists specifying the needed device capabilities. */
  capabilities: string[][];

  /** Number of devices to create. */
  count: number;

  /** List of device IDs to create. */
  deviceIds: string[];

  /** Driver to talk to. */
  driver: string;

  /** Key/value options directly passed to the driver. */
  options?: { [key: string]: string };
};

export type DockerExportImageOptions = {
  /**
   * Platform which will be used to select a platform-specific image to be exported in case the image is multi-platform.
   * If not provided the full multi-platform image will be exported.
   */
  platform?: DockerOCIPlatform;
};

export type DockerExportImagesOptions = {
  /** Image names or ids to filter by. */
  names?: string | string[];

  /**
   * Platform which will be used to select a platform-specific image to be exported in case the image is multi-platform.
   * If not provided the full multi-platform image will be exported.
   */
  platform?: DockerOCIPlatform;
};

export type DockerExposePort = {
  /** Port inside the container that should be exposed to other containers. */
  containerPort: number;

  /** Protocol that is used for the exposed port. */
  protocol: DockerProtocol;
};

export type DockerGetContainerLogsOptions = {
  /** Only returns logs since the given Date or UNIX timestamp. */
  since?: Date | number;

  /** Return logs from stderr (default false). */
  stdErr?: boolean;

  /** Return logs from stdout (default false). */
  stdOut?: boolean;

  /**
   * Keep the connection open after returning logs and continue streaming new logs (default false).
   * The logs will be provided and streamed by invoking the provided callback function on each new log line.
   * If the container was created with tty=true, the logs will only be a stream of type stdout.
   */
  stream?: boolean;

  /** Returns the last N lines of logs (default 'all'). */
  tail?: number | 'all';

  /** Show timestamps in the logs for each line (default false). */
  timestamps?: boolean;

  /** Only returns logs until the given Date or UNIX timestamp. */
  until?: Date | number;
};
export type DockerGetContainerLogsResponseStream = {
  /** Log as a stream (if 'stream' is true). */
  stream: DockerLogStream;
};
export type DockerGetContainerLogsResponseText = {
  /** Log as plain text (if 'stream' is false). */
  text: string;
};
export type DockerGetContainerLogsResponse = DockerGetContainerLogsResponseStream | DockerGetContainerLogsResponseText;
export type DockerGetContainerLogsResponseError = {
  /** If no container with the given ID or name was not found. */
  notFound?: boolean;
};

export type DockerGetContainersOptions = {
  /** If all containers, even stopped ones, should be included and not only running ones (default false). */
  all?: boolean;

  /** Maximum number of containers to return sorted by most recently created (default all). */
  limit?: number;

  /** If the storage size of the container should be included in the response (default false). */
  size?: boolean;

  /** Filters for querying containers. */
  filters?: {
    /** Return containers with an ancestor image of given name or ID. */
    ancestorImage?: string | string[];

    /** Return containers younger than a given container provided by name or ID. */
    beforeContainer?: string | string[];

    /** Return containers with exposed ports in the format 'port[/proto>]' or '<startPort>-<endPort>[/<proto>]'. */
    exposedPorts?: string | string[];

    /** Return containers with a given exit code number. */
    exitCode?: number | number[];

    /** Return containers with a given health state. */
    healthState?: (DockerContainerHealthState | 'none') | (DockerContainerHealthState | 'none')[];

    /** Return containers with a given ID. */
    id?: string | string[];

    /** Return containers that are a task or not. */
    isTask?: boolean;

    /** Return containers with a given labels. */
    labels?: { [key: string]: string | null };

    /** Return containers with a given name. */
    name?: string | string[];

    /** Return containers with a given network id or name. */
    network?: string | string[];

    /** Return containers with published ports in the format 'port[/proto>]' or '<startPort>-<endPort>[/<proto>]'. */
    publishedPort?: number | number[];

    /** Return containers older than a given container provided by name or ID. */
    sinceContainer?: string | string[];

    /** Return containers with a given state. */
    state?: DockerContainerState | DockerContainerState[];

    /** Return containers with a given volume name or mount point destination. */
    volume?: string | string[];

    /** Return containers with a given Windows isolation mode. */
    windowsIsolation?: DockerWindowsIsolation | DockerWindowsIsolation[];
  };
};

export type DockerGetContainerStatsOptions = {
  /** Only get a single stat instead of waiting for 2 cycles (ignored if 'stream' is true). */
  oneShot?: boolean;

  /** Whether to keep the connection open and stream stats continuously (default false). */
  stream?: boolean;
};
export type DockerGetContainerStatsResult = {
  /** Single stats result if 'stream' is false. */
  single?: DockerContainerStats;

  /** Continuous stats stream if 'stream' is true. */
  stream?: DockerStatsStream;
};
export type DockerGetContainerStatsResponseError = {
  /** If no container with the given ID or name was found. */
  notFound?: boolean;
};

export type DockerGetImagesOptions = {
  /** If all images, even intermediate ones, should be included and not only top-level ones (default false). */
  all?: boolean;

  /** Whether to add digest information for each image by adding the additional property 'digests' (default false). */
  digests?: boolean;

  /** Filters to select specific images. */
  filters?: {
    /** Select images created before the given image ID or name in the format <image-name>[:tag] or <image-id> or <image@digest> */
    beforeImage?: string | string[];

    /** Select only dangling images (unreferenced by any container). */
    dangling?: boolean;

    /** Select images with a given label. */
    labels?: { [key: string]: string | null };

    /** Select images with a reference to the given image in the form <image-name>[:tag] */
    reference?: string;

    /** Select images created after the given image ID or name in the format <image-name>[:tag] or <image-id> or <image@digest> */
    sinceImage?: string | string[];

    /** Select images created before the given timestamp. */
    until?: Date;
  };

  /** Whether to add manifest information for each image by adding the additional property 'manifests' (default false). */
  manifests?: boolean;

  /** Compute and return the shared size of each image by adding the additional property 'sharedSize' (default false). */
  sharedSize?: boolean;
};

export type DockerHealthCheck = {
  /** Interval in seconds (can be float) to wait between health checks. Undefined, negative or zero means inherit from image. */
  interval?: number;

  /** Number of consecutive failures needed to consider the container unhealthy. Undefined, negative or zero means inherit from image. */
  retries?: number;

  /** Interval in seconds (can be float) to wait between health checks during the start period. Undefined, negative or zero means inherit from image. */
  startInterval?: number;

  /** Duration in seconds (can be float) in which failing health checks are ignored. Undefined, negative or zero means inherit from image. */
  startPeriod?: number;

  /** Test to perform as health check. */
  test: {
    /** If type='arguments' the arguments to directly execute. */
    arguments?: string[];

    /** If type='command' the command to execute in the system's default shell. */
    command?: string;

    /**
     * Type of test to perform. Possible values are:
     * - 'arguments': Execute the specified arguments as a health check.
     * - 'command': Execute the specified command as a health check.
     * - 'inherit': Inherit the health check from the parent container.
     * - 'none': Disable health checks even if specified in the image.
     */
    type: 'arguments' | 'command' | 'inherit' | 'none';
  };

  /** Timeout in seconds (can be float) for the health check. Undefined, negative or zero means inherit from image. */
  timeout?: number;
};

export type DockerHostConfigNetwork = {
  /** Network mode to use for the container. */
  networkMode?: DockerContainerNetworkMode;

  /** Additional annotations for the container. */
  annotations?: { [key: string]: string };
};

export type DockerHostConfig = DockerHostConfigNetwork & {
  /** Automatically deletes the container when it exits (no effect if restart policy is set). */
  autoRemove?: boolean;

  /** List of bind mounts for the container. */
  binds?: DockerBind[];

  /** Block IO read rate limit (bytes per second) of the container for I/O operations. */
  blockIoDeviceReadBps?: { [devicePath: string]: number };

  /** Block IO read rate limit (operations per second) of the container for I/O operations. */
  blockIoDeviceReadOps?: { [devicePath: string]: number };

  /**
   * Block IO weight (relative priority) of the container for I/O operations compared to other containers
   * per device path (0 - 1000).
   */
  blockIoDeviceWeight?: { [devicePath: string]: number };

  /** Block IO write rate limit (bytes per second) of the container for I/O operations. */
  blockIoDeviceWriteBps?: { [devicePath: string]: number };

  /** Block IO write rate limit (operations per second) of the container for I/O operations. */
  blockIoDeviceWriteOps?: { [devicePath: string]: number };

  /** Block IO weight (relative priority) of the container for I/O operations compared to other containers (0 - 1000). */
  blockIoWeight?: number;

  /** List of capabilities to add to the container. Conflicts with the option 'capabilites'. */
  capabilitiesAdd?: string[];

  /** List of capabilities to remove from the container. Conflicts with the option 'capabilites'. */
  capabilitiesDrop?: string[];

  /** cgroup to use for the container. */
  cGroup?: string;

  /**
   * cgroup namespace mode for the container (defaults to daemon settings):
   * - 'private': the container has its own cgroup namespace.
   * - 'host': the container shares the host's cgroup namespace.
   */
  cGroupNamespaceMode?: 'private' | 'host';

  /** Path to cgroups under which the container's cgroup is created. */
  cGroupParent?: string;

  /** Initial console size. */
  consoleSize?: {
    /** Console width in characters. */
    width: number;

    /** Console height in characters. */
    height: number;
  };

  /** Path to a file where the container ID is written. */
  containerIdFile?: string;

  /**
   * Number of CPU cores the container is allowed to use (Windows only).
   * Mutually exclusive order: 1. cpuCount | 2. cpuShares | 3. cpuPercent
   */
  cpuCount?: number;

  /**
   * Percentage of CPU cores the container is allowed to use as integer in the range 0-100 (Windows only).
   * Mutually exclusive order: 1. cpuCount | 2. cpuShares | 3. cpuPercent
   */
  cpuPercent?: number;

  /** Length of a CPU period in microseconds. */
  cpuPeriod?: number;

  /** Microseconds of CPU time the container can get in a CPU period. */
  cpuQuota?: number;

  /** Length of a CPU real-time period in microseconds. Zero to allocate no time allocated to real-time tasks. */
  cpuRealtimePeriod?: number;

  /** Length of a CPU real-time runtime in microseconds. Zero to allocate no time allocated to real-time tasks. */
  cpuRealtimeRuntime?: number;

  /**
   * CPUs (or cores) to which the container is allowed to be scheduled on.
   * Either a number or a range as string e.g. '0-3'.
   */
  cpuSetCpus?: (number | string)[];

  /**
   * Memory nodes to which the container is allowed to be scheduled on (only effective on NUMA systems).
   * Either a number or a range as string e.g. '0-3'.
   */
  cpuSetMemoryNodes?: (number | string)[];

  /**
   * Integer value representing the container's relative CPU weight compared to other containers.
   * On Windows mutually exclusive order: 1. cpuCount | 2. cpuShares | 3. cpuPercent
   */
  cpuShares?: number;

  /** List of cgroup rules to apply to the container. */
  deviceCgroupRules?: string[];

  /** List of requests for devices to be sent to the drivers. */
  deviceRequests?: DockerDeviceRequest[];

  /** List of devices that should be accessible inside the container. */
  devices?: DockerDevice[];

  /** List of DNS options for the container to use. */
  dnsOptions?: string[];

  /** List of DNS search domains. */
  dnsSearch?: string[];

  /** List of DNS servers for the container to use. */
  dnsServers?: string[];

  /** Hostnames to IP mappings that will be added to the container's /etc/hosts file. */
  extraHosts?: { [hostname: string]: string };

  /** List of additional groups that the container process will run as. */
  groupAdd?: string[];

  /** Whether to run an init inside the container that forwards signals and reaps processes. Defaults to configured daemon value. */
  init?: boolean;

  /** Maximum IO operations for the container system drive (Windows only). */
  ioMaxOps?: number;

  /** Maximum IO bandwidth in bytes per second for the container system drive (Windows only). */
  ioMaxBps?: number;

  /** Inter-process communication (IPC) mode for the container (defaults to daemon settings). */
  ipcMode?: {
    /** If mode is 'container' then the name or id of the container to join the IPC namespace. */
    containerIdOrName?: string;

    /**
     * IPC mode for the container (defaults to daemon settings: 'private' or 'shareable'):
     * - 'container': join the IPC namespace of the specified container.
     * - 'host': use host system IPC namespace.
     * - 'none': own private IPC namespace with /dev/shm not mounted.
     * - 'private': own private IPC namespace.
     * - 'shareable': own private IPC namespace with possibility to share it with other containers.
     */
    mode: 'container' | 'host' | 'none' | 'private' | 'shareable';
  };

  /** Hard limit in bytes for the kernel TCP buffer memory (may be ignored depending on the OCI runtime). */
  kernelMemoryTCP?: number;

  /** List of links mapping container names to aliases. */
  links?: DockerContainerLink[];

  /** Logging configuration for the container. */
  logging?: DockerLogConfig;

  /** List of paths to be masked inside the container (this overrides the default set of paths). */
  maskedPaths?: string[];

  /** Memory limit in bytes. */
  memoryLimit?: number;

  /** Memory soft limit in bytes. */
  memoryReservation?: number;

  /** Total memory limit (memory + swap). -1 for unlimited swap size. */
  memorySwap?: number;

  /** Memory swappiness behavior (0-100). */
  memorySwappiness?: number;

  /** List of mounts to be added to the container. */
  mounts?: DockerContainerMountCreate[];

  /** CPU quota in units of 10<sup>-9</sup> CPUs. */
  nanoCpus?: number;

  /** Network mode to use for the container. */
  networkMode?: DockerContainerNetworkMode;

  /** Disable out-of-memory killer for the container. */
  outOfMemoryKillDisable?: boolean;

  /** Integer value containing the score given to the container in order to tune out-of-memory killer preferences. */
  outOfMemoryScore?: number;

  /** Limit the container's PID. Negative or zero means no limit. null or undefined to not change. */
  pidLimit?: number | null;

  /** PID (process) namespace for the container. */
  pidMode?: DockerContainerPidMode;

  /** Port mappings from the host to the container. */
  portBindings?: DockerPortMapping[];

  /** Whether the container is run in privileged mode which gives the container full access to the host. */
  privileged?: boolean;

  /**
   * Allocates an ephemeral host port for all of the container's exposed ports.
   * Allocated ports are released when the container stops.
   * After container restart different ports might be allocated.
   * Port is selected from the ephemeral port range depending on the kernel (e.g. /proc/sys/net/ipv4/ip_local_port_range).
   */
  publishAllPorts?: boolean;

  /** List of paths inside the container that should be read-only (this overrides the default set of paths). */
  readOnlyPaths?: string[];

  /** Restart policy for the container. */
  restart?: DockerRestartPolicy;

  /** Whether to mount the container's root filesystem as read-only. */
  rootFsReadOnly?: boolean;

  /** Runtime to use for the container (e.g. 'runc'). */
  runtime?: string;

  /** List of strings to customize labels for the MLS system, such as SELinux. */
  securityOptions?: string[];

  /** Size of the shared memory (/dev/shm) for the container (default: 64MB). */
  shmSize?: number;

  /** Storage driver options for the container (e.g. {"size": "120G"}). */
  storageOptions?: { [key: string]: string };

  /** Sysctl options for the container (e.g. {"net.ipv4.tcp_syncookies": "1"}). */
  sysctls?: { [key: string]: string };

  /** List of container directories which should be replaced by tmpfs mounts. */
  tmpfs?: DockerTmpfs[];

  /** ulimits (resource limits) to set in the container. */
  uLimits?: DockerULimit[];

  /** User namespace mode for the container when user namespace remapping option is set. */
  userNameSpaceMode?: string;

  /** UTS (Unix Time Sharing) namespace for the container. */
  utsMode?: string;

  /** Driver that container uses to mount volumes. */
  volumeDriver?: string;

  /** List of volumes to inherit from other containers. */
  volumesInheritFrom?: DockerContainerInheritedVolume[];

  /** Isolation technology for the container (Windows only). */
  windowsIsolation?: DockerWindowsIsolation;
};

export type DockerIdentityToken = string;

export type DockerImage = {
  /** Descriptor for the image containing digest, media type, and size. */
  descriptor: DockerOCIDescriptor;

  /**
   * List of digest hashes of locally cached image manifests that the image is referenced from (only present if 'digests' option is true).
   * Digests are usually only available if the image was either pulled from a registry or if
   * the image was pushed to a registry.
   */
  digests?: string[];

  /** Number of running and stopped containers using this image. */
  containers?: number;

  /** Timestamp when the image was created. */
  created: Date;

  /** ID of the image. */
  imageId: string;

  /** List of labels associated with the image. */
  labels: { [key: string]: string };

  /** List of image manifests associated with the image. */
  manifests: DockerImageManifestSummary[];

  /** ID of the parent image if this image is derived from another image. */
  parentId?: string;

  /** Total size of the image layers that are shared between this image and other images (only present if 'sharedSize' option is true). */
  sharedSize?: number;

  /** Total size of the image including all layers it is composed of. */
  size: number;

  /** List of images tags and names associated with the image in the local image cache (can be empty in case it is 'untagged'). */
  tags: string[];
};

export type DockerImageManifestSummary = {
  /** Image data for the attestation manifest (only if 'kind' is 'attestation'). */
  attestationData?: {
    /** Digest of the image manifest that this attestation is for. */
    for: string;
  };

  /** Indicates that all child content (image config, layers) is fully available locally. */
  available: boolean;

  /** Descriptor containing digest, media type, and size. */
  descriptor: DockerOCIDescriptor;

  /** Image data for the image manifest (only if 'kind' is 'image'). */
  imageData?: {
    /** List of container IDs that are using the image. */
    containers: string[];

    /** Describes the platform which the image in the manifest runs on. */
    platform?: DockerOCIPlatform;

    /**
     * Size of the locally uncompressed image content in bytes.
     * It's independent of the distributable content - e.g.
     * the image might still have an unpacked data that's still used by some container even when the distributable/compressed content is already gone.
     */
    unpackedSize: number;
  };

  /** ID of the image. */
  imageId: string;

  /** Kind of manifest:
   * - 'attestation': Attestation manifest produced by the Buildkit builder for a specific image manifest.
   * - 'image': Manifest can be used to start a container.
   * - 'unknown': Indicates the manifest type is unknown.
   */
  kind: 'attestation' | 'image' | 'unknown';

  /** Size information of the image. */
  size: {
    /** Content size of blobs in bytes of all the locally present content (image config, layers) references by this manifest and its children. */
    content: number;

    /** Total size in bytes of all the content (image config, layers) references by this manifest and its children. */
    total: number;
  };
};

export type DockerImportImagesOptions = {
  /**
   * Platform which will be used to select a platform-specific image to be loaded if the image is multi-platform.
   * If not provided, the full multi-platform image will be loaded.
   */
  platform?: DockerOCIPlatform;

  /** Suppress progress details during load (default false). */
  quiet?: boolean;
};

export type DockerKillContainerResponseError = {
  /** If no container with the given ID or name was not found. */
  notFound?: boolean;

  /** If the container is not running. */
  notRunning?: boolean;
};

export type DockerLogConfig = {
  /** Type of logging driver to use. */
  type: 'awslogs' | 'etwlogs' | 'fluentd' | 'gelf' | 'journald' | 'json-file' | 'local' | 'none' | 'splunk' | 'syslog';

  /** Configuration options for the logging driver. */
  config: { [key: string]: string };
};

/**
 * Type of mount into a container. Possible values are:
 * - 'bind': Mount of a file or directory from the host into the container.
 * - 'cluster': Docker Swarm volume.
 * - 'image': Docker image.
 * - 'npipe': Named pipe from the host into the container.
 * - 'tmpfs': Temporary filesystem mount.
 * - 'volume': Docker volume.
 */
export type DockerMountType = 'bind' | 'cluster' | 'image' | 'npipe' | 'tmpfs' | 'volume';

export type DockerOCIDescriptor = {
  /** Arbitrary metadata relating to the targeted content. */
  annotations: { [key: string]: string };

  /** IANA media type of this artifact. */
  artifactType?: string;

  /** Embedding of the target content data. If present can be used directly to avoid fetching the targeted content. */
  data?: Buffer;

  /** Digest hash of the targeted content. */
  digest: string;

  /** Media type of the object this schema refers to. */
  mediaType: string;

  /** Platform information for the content. */
  platform?: DockerOCIPlatform;

  /** Size in bytes of the blob. */
  size: number;

  /** List of URLs from which this object MAY be downloaded. */
  urls: string[];
};

export type DockerOCIPlatform = {
  /** CPU architecture (e.g. amd64, arm64, ppc64, etc.). */
  architecture: string;

  /** Operating system (e.g. linux, windows, etc.). */
  os: string;

  /** Specific OS version if specified. */
  osVersion?: string;

  /** List of required OS features (e.g. win32k, etc.) (can be empty). */
  osFeatures: string[];

  /** Specific variant of the CPU (e.g. 'v7' for ARMv7 if architecture is 'arm'). */
  variant?: string;
};

export type DockerPortMapping = {
  /** Port inside the container to forward to. */
  containerPort: number;

  /** If listening on the host is bound to a particular hostname or ip. If not present all interfaces are accepted. */
  hostAddress?: string;

  /** Source port on the host to listen at. */
  hostPort: number;

  /** Protocol that is mapped. */
  protocol: DockerProtocol;
};

/**
 * Protocol used for communication. Possible values are:
 * - 'sctp': Stream Control Transmission Protocol.
 * - 'tcp': Transmission Control Protocol.
 * - 'udp': User Datagram Protocol.
 */
export type DockerProtocol = 'sctp' | 'tcp' | 'udp';

export type DockerPullImageOptions = {
  /** Platform to pull the image for in the format <os>[/<arch>[/<variant>]]. If not specified, the image will be pulled for the current platform. */
  platform?: string;

  /** X-Registry-Auth header to include if the registry is private and requires authentication. */
  registryAuth?: DockerCredentials | DockerIdentityToken;

  /** Tag or digest to pull. If not provided and also not in image name included, all tags for the given image will be pulled. */
  tag?: string;
};
export type DockerPullImageResponseError = {
  /** If the image was not found. */
  notFound?: boolean;
};

export type DockerRestartContainerOptions = {
  /** Signal to send to the container as an inter or string (e.g. SIGINT). */
  signal?: number | string;

  /** Seconds to wait before killing the container. */
  timeout?: number;
};
export type DockerRestartContainerResponseError = {
  /** If no container with the given ID or name was not found. */
  notFound?: boolean;
};

export type DockerRestartPolicy = {
  /** Name of the restart policy. */
  name: 'always' | 'no' | 'on-failure' | 'unless-stopped';

  /** Maximum retry count if name is 'on-failure'. */
  maximumRetryCount?: number;
};

export type DockerStartContainerResponseError = {
  /** If the container was already started. */
  alreadyStarted?: boolean;

  /** If no container with the given ID or name was not found. */
  notFound?: boolean;
};

export type DockerStopContainerOptions = {
  /** Signal to send to the container as an inter or string (e.g. SIGINT). */
  signal?: number | string;

  /** Seconds to wait before killing the container. */
  timeout?: number;
};
export type DockerStopContainerResponseError = {
  /** If the container was already stopped. */
  alreadyStopped?: boolean;

  /** If no container with the given ID or name was not found. */
  notFound?: boolean;
};

export type DockerTmpfs = {
  /**
   * If device files can be created and used (default 'no'):
   * - 'no': Device files cannot be created or used.
   * - 'create-only': Device files can be created but are not functional (access results in an error).
   * - 'yes': Device files can be created and used.
   */
  deviceFile?: 'no' | 'create-only' | 'yes';

  /** Group ID for the owner of the tmpfs mount e.g. '1000'. */
  gid?: string;

  /** Maximum number of blocks for the tmpfs mount e.g. '1024'. */
  maxBlocks?: number | string;

  /** Maximum number of inodes for the tmpfs mount e.g. '400k'. */
  maxInodes?: number | string;

  /** File mode (permissions) for the tmpfs mount e.g. '1777'. */
  mode?: string;

  /** Mount path for the tmpfs. */
  mountPath: string;

  /** If the tmpfs should not update access time each time a file is accessed (default false). */
  noAccessTime?: boolean;

  /** If the tmpfs should not update directory access time each time a directory is accessed (default false). */
  noDirAccessTime?: boolean;

  /** If the tmpfs should not be executed (default false). */
  noExecute?: boolean;

  /** Prevents setuid and setgid bits from being honored during execution (default false). */
  noSetUid?: boolean;

  /** If the tmpfs should only be read-only. */
  readOnly?: boolean;

  /** Size of the tmpfs either as number of bytes or a string with a unit (e.g. "100m", "1g"). */
  size?: number | string;

  /** Whether directory updates within the file system are done synchronously (default false). */
  syncDir?: boolean;

  /** If the tmpfs should use synchronous I/O (default false). */
  syncIO?: boolean;

  /** User ID for the owner of the tmpfs mount e.g. '1000'. */
  uid?: string;
};

export type DockerULimit = {
  /** Name of the ulimit. */
  name: string;

  /** Soft limit for the ulimit. */
  soft: number;

  /** Hard limit for the ulimit. */
  hard: number;
};

/**
 * Windows isolation mode for containers. Possible values are:
 * - 'default': Default isolation mode.
 * - 'process': Process isolation mode.
 * - 'hyperv': Hyper-V isolation mode.
 */
export type DockerWindowsIsolation = 'default' | 'process' | 'hyperv';
