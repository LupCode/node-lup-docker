import DockerClient from './client';
import { DockerContainer, DockerCreateContainerOptions, DockerCreateContainerResponse, DockerCreateContainerResponseDockerError, DockerDeleteContainerOptions, DockerDeleteContainerResponseError, DockerGetContainerLogsOptions, DockerGetContainerLogsResponse, DockerGetContainerLogsResponseError, DockerGetContainersOptions, DockerGetContainerStatsOptions, DockerGetContainerStatsResponseError, DockerGetContainerStatsResult, DockerKillContainerResponseError, DockerRestartContainerOptions, DockerRestartContainerResponseError, DockerResult, DockerStartContainerResponseError, DockerStopContainerOptions, DockerStopContainerResponseError } from './types';

const DOCKER = new DockerClient();


/**
 * Creates a Docker container.
 * 
 * @param image Name or reference of the image to use for creating the container.
 * @param options Options for creating the container.
 * @returns ContainerID and warnings or an error.
 */
export async function createContainer(image: string, options?: DockerCreateContainerOptions): Promise<DockerResult<DockerCreateContainerResponse, DockerCreateContainerResponseDockerError>> {
  return DOCKER.createContainer(image, options);
}


/**
 * Deletes a container.
 * 
 * @param containerIdOrName ID or name of the container to delete.
 * @param options Optional options for deleting the container.
 * @returns Empty object on success or an error.
 */
export async function deleteContainer(containerIdOrName: string, options?: DockerDeleteContainerOptions): Promise<DockerResult<{}, DockerDeleteContainerResponseError>> {
  return DOCKER.deleteContainer(containerIdOrName, options);
}


/**
 * Returns the logs of a container either as string or as stream.
 * 
 * @param containerIdOrName ID or name of the container to return the logs from.
 * @param options Optional options for querying logs.
 * @returns Logs of the container or an error.
 */
export async function getContainerLogs(containerIdOrName: string, options?: DockerGetContainerLogsOptions): Promise<DockerResult<DockerGetContainerLogsResponse, DockerGetContainerLogsResponseError>> {
  return DOCKER.getContainerLogs(containerIdOrName, options);
}


/**
 * Returns a list of containers.
 * 
 * @param options Optional options for querying containers.
 * @returns List of containers or an error.
 */
export async function getContainers(options?: DockerGetContainersOptions): Promise<DockerResult<DockerContainer[]>> {
  return DOCKER.getContainers(options);
}


/**
 * Returns the utilization stats for a container as single value or as continuous stream.
 *
 * @param containerIdOrName ID or name of the container.
 * @param options Options for fetching the stats.
 * @returns Single stats object, stream of stat objects, or an error.
 */
export async function getContainerStats(containerIdOrName: string, options?: DockerGetContainerStatsOptions): Promise<DockerResult<DockerGetContainerStatsResult, DockerGetContainerStatsResponseError>> {
  return DOCKER.getContainerStats(containerIdOrName, options);
}


/**
 * Kills a container or sends another signal to the container.
 * Killing a container is similar to stopping it except that it immediately terminates the container's processes.
 *
 * @param containerIdOrName ID or name of the container.
 * @param signal Optional signal to send to the container.
 * @returns Promise resolving to empty object on successful kill or an error.
 */
export async function killContainer(containerIdOrName: string, signal?: number | string): Promise<DockerResult<{}, DockerKillContainerResponseError>> {
  return DOCKER.killContainer(containerIdOrName, signal);
}


/**
 * Restarts a container.
 *
 * @param containerIdOrName ID or name of the container.
 * @param options Optional parameters for restarting the container.
 * @returns Promise resolving to empty object on successful restart or an error.
 */
export async function restartContainer(containerIdOrName: string, options?: DockerRestartContainerOptions): Promise<DockerResult<{}, DockerRestartContainerResponseError>> {
  return DOCKER.restartContainer(containerIdOrName, options);
}


/**
 * Starts a container.
 *
 * @param containerIdOrName ID or name of the container.
 * @param detachKeys Optional key sequence for detaching the container. Single character [a-Z] or ctrl-<value> with <value> being [a-z], '@', '^', ',', '[', or '_'.
 * @returns Promise resolving to empty object on successful start or an error.
 */
export async function startContainer(containerIdOrName: string, detachKeys?: string): Promise<DockerResult<{}, DockerStartContainerResponseError>> {
  return DOCKER.startContainer(containerIdOrName, detachKeys);
}


/**
 * Stops a running container.
 * 
 * @param containerIdOrName ID or name of the container.
 * @param options Optional parameters for stopping the container.
 * @returns Promise resolving to empty object on successful stop or an error.
 */
export async function stopContainer(containerIdOrName: string, options?: DockerStopContainerOptions): Promise<DockerResult<{}, DockerStopContainerResponseError>> {
  return DOCKER.stopContainer(containerIdOrName, options);
}


const Docker = {
  DockerClient,
  createContainer,
  deleteContainer,
  getContainerLogs,
  getContainers,
  getContainerStats,
  killContainer,
  restartContainer,
  startContainer,
  stopContainer,
};
export default Docker;