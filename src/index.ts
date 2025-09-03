import DockerClient from './client';
import { DockerLogStream, DockerStatsStream, DockerStatsStreamReader } from './stream';
import {
  DockerContainer,
  DockerContainerStats,
  DockerCreateContainerOptions,
  DockerCreateContainerResponse,
  DockerCreateContainerResponseDockerError,
  DockerCreateImageOptions,
  DockerCreateImageResponseError,
  DockerDeleteContainerOptions,
  DockerDeleteContainerResponseError,
  DockerExportImageOptions,
  DockerExportImagesOptions,
  DockerGetContainerLogsOptions,
  DockerGetContainerLogsResponseError,
  DockerGetContainersOptions,
  DockerGetContainerStatsOptions,
  DockerGetContainerStatsResponseError,
  DockerGetImagesOptions,
  DockerImage,
  DockerImportImagesOptions,
  DockerKillContainerResponseError,
  DockerPullImageOptions,
  DockerPullImageResponseError,
  DockerRestartContainerOptions,
  DockerRestartContainerResponseError,
  DockerResult,
  DockerStartContainerResponseError,
  DockerStopContainerOptions,
  DockerStopContainerResponseError,
} from './types';

const CLIENT = new DockerClient();

const Docker = {
  /**
   * Creates a Docker container.
   *
   * @param image Name or reference of the image to use for creating the container.
   * @param options Options for creating the container.
   * @returns ContainerID and warnings or an error.
   */
  async createContainer(
    image: string,
    options?: DockerCreateContainerOptions,
  ): Promise<DockerResult<DockerCreateContainerResponse, DockerCreateContainerResponseDockerError>> {
    return CLIENT.createContainer(image, options);
  },

  /**
   * Imports an image from an URL or directly from a buffer representing the root filesystem snapshot.
   * To pull an image from a registry use the pullImage() method.
   * To import an image from a saved container or that has been exported use the importImage() method.
   *
   * @param source Source of the image to import. Either a URL or a Buffer representing the root filesystem snapshot like debootstrap output.
   * @param options Optional parameters for importing the image.
   * @returns Empty object on success or an error.
   */
  async createImage(
    source: string | URL | ArrayBuffer,
    options?: DockerCreateImageOptions,
  ): Promise<DockerResult<{}, DockerCreateImageResponseError>> {
    return CLIENT.createImage(source, options);
  },

  /**
   * Deletes a container.
   *
   * @param containerIdOrName ID or name of the container to delete.
   * @param options Optional options for deleting the container.
   * @returns Empty object on success or an error.
   */
  async deleteContainer(
    containerIdOrName: string,
    options?: DockerDeleteContainerOptions,
  ): Promise<DockerResult<{}, DockerDeleteContainerResponseError>> {
    return CLIENT.deleteContainer(containerIdOrName, options);
  },

  /**
   * Exports an image as a TAR archive file including all its layers (parent images).
   *
   * @param imageIdOrName ID or name of the image (if name is provided, a repositories file is included with the information about the repository).
   * @param options Additional options for exporting the image.
   * @returns A stream of the exported image TAR archive.
   */
  async exportImage(
    imageIdOrName: string,
    options?: DockerExportImageOptions,
  ): Promise<DockerResult<ReadableStream<Uint8Array>>> {
    return CLIENT.exportImage(imageIdOrName, options);
  },

  /**
   * Exports multiple images as a TAR archive file including all their layers (parent images).
   *
   * @param options Additional options for exporting the images.
   * @returns A stream of the exported images TAR archive.
   */
  async exportImages(options?: DockerExportImagesOptions): Promise<DockerResult<ReadableStream<Uint8Array>>> {
    return CLIENT.exportImages(options);
  },

  /**
   * Returns the logs of a container as string.
   *
   * @param containerIdOrName ID or name of the container to return the logs from.
   * @param options Optional options for querying logs.
   * @returns Logs of the container as a string or an error.
   */
  async getContainerLogs(
    containerIdOrName: string,
    options?: DockerGetContainerLogsOptions,
  ): Promise<DockerResult<string, DockerGetContainerLogsResponseError>> {
    return CLIENT.getContainerLogs(containerIdOrName, options);
  },

  /**
   * Returns the logs of a container as a continuous stream.
   * If the container was created with tty=true, the logs will only be a stream of type stdout.
   *
   * @param containerIdOrName ID or name of the container to return the logs from.
   * @param options Optional options for querying logs.
   * @returns Logs of the container as stream or an error.
   */
  async getContainerLogsStream(
    containerIdOrName: string,
    options?: DockerGetContainerLogsOptions,
  ): Promise<DockerResult<DockerLogStream, DockerGetContainerLogsResponseError>> {
    return CLIENT.getContainerLogsStream(containerIdOrName, options);
  },

  /**
   * Returns a list of containers.
   *
   * @param options Optional options for querying containers.
   * @returns List of containers or an error.
   */
  async getContainers(options?: DockerGetContainersOptions): Promise<DockerResult<DockerContainer[]>> {
    return CLIENT.getContainers(options);
  },

  /**
   * Returns the utilization stats for a container as single value.
   *
   * @param containerIdOrName ID or name of the container.
   * @param options Options for fetching the stats.
   * @returns Stats object or an error.
   */
  async getContainerStats(
    containerIdOrName: string,
    options?: DockerGetContainerStatsOptions,
  ): Promise<DockerResult<DockerContainerStats, DockerGetContainerStatsResponseError>> {
    return CLIENT.getContainerStats(containerIdOrName, options);
  },

  /**
   * Returns the utilization stats for a container as a continuous stream
   * tunneled into a stream reader.
   *
   * @warning The stream will continuously produce stats objects which accumulate over time if not consumed!
   *
   * @param containerIdOrName ID or name of the container.
   * @returns Stream of stat objects tunneled into a stream reader or an error.
   */
  async getContainerStatsReader(
    containerIdOrName: string,
  ): Promise<DockerResult<DockerStatsStreamReader, DockerGetContainerStatsResponseError>> {
    return CLIENT.getContainerStatsReader(containerIdOrName);
  },

  /**
   * Returns the utilization stats for a container as a continuous stream.
   *
   * @param containerIdOrName ID or name of the container.
   * @returns Stream of stat objects or an error.
   */
  async getContainerStatsStream(
    containerIdOrName: string,
  ): Promise<DockerResult<DockerStatsStream, DockerGetContainerStatsResponseError>> {
    return CLIENT.getContainerStatsStream(containerIdOrName);
  },

  /**
   * Returns a list of images.
   *
   * @param options Options for filtering the images.
   * @returns List of images or an error.
   */
  async getImages(options?: DockerGetImagesOptions): Promise<DockerResult<DockerImage[]>> {
    return CLIENT.getImages(options);
  },

  /**
   * Import one or multiple images from a TAR file that previously have been exported.
   *
   * @param imagesTar TAR archive file containing a set of images and tags.
   * @param options Additional options for importing the images.
   * @returns Empty object on success or an error.
   */
  async importImages(
    imagesTar: ArrayBuffer | ReadableStream,
    options?: DockerImportImagesOptions,
  ): Promise<DockerResult> {
    return CLIENT.importImages(imagesTar, options);
  },

  /**
   * Kills a container or sends another signal to the container.
   * Killing a container is similar to stopping it except that it immediately terminates the container's processes.
   *
   * @param containerIdOrName ID or name of the container.
   * @param signal Optional signal to send to the container.
   * @returns Promise resolving to empty object on successful kill or an error.
   */
  async killContainer(
    containerIdOrName: string,
    signal?: number | string,
  ): Promise<DockerResult<{}, DockerKillContainerResponseError>> {
    return CLIENT.killContainer(containerIdOrName, signal);
  },

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
  async pullImage(
    imageName: string,
    options?: DockerPullImageOptions,
  ): Promise<DockerResult<{}, DockerPullImageResponseError>> {
    return CLIENT.pullImage(imageName, options);
  },

  /**
   * Restarts a container.
   *
   * @param containerIdOrName ID or name of the container.
   * @param options Optional parameters for restarting the container.
   * @returns Promise resolving to empty object on successful restart or an error.
   */
  async restartContainer(
    containerIdOrName: string,
    options?: DockerRestartContainerOptions,
  ): Promise<DockerResult<{}, DockerRestartContainerResponseError>> {
    return CLIENT.restartContainer(containerIdOrName, options);
  },

  /**
   * Starts a container.
   *
   * @param containerIdOrName ID or name of the container.
   * @param detachKeys Optional key sequence for detaching the container. Single character [a-Z] or ctrl-<value> with <value> being [a-z], '@', '^', ',', '[', or '_'.
   * @returns Promise resolving to empty object on successful start or an error.
   */
  async startContainer(
    containerIdOrName: string,
    detachKeys?: string,
  ): Promise<DockerResult<{}, DockerStartContainerResponseError>> {
    return CLIENT.startContainer(containerIdOrName, detachKeys);
  },

  /**
   * Stops a running container.
   *
   * @param containerIdOrName ID or name of the container.
   * @param options Optional parameters for stopping the container.
   * @returns Promise resolving to empty object on successful stop or an error.
   */
  async stopContainer(
    containerIdOrName: string,
    options?: DockerStopContainerOptions,
  ): Promise<DockerResult<{}, DockerStopContainerResponseError>> {
    return CLIENT.stopContainer(containerIdOrName, options);
  },
};
export default Docker;
