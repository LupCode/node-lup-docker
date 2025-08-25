import DockerClient from './client';
import { DockerContainer, DockerCreateContainerOptions, DockerCreateContainerResponse, DockerCreateContainerResponseDockerError, DockerGetContainerLogsOptions, DockerGetContainerLogsResponse, DockerGetContainerLogsResponseError, DockerGetContainersOptions, DockerGetContainerStatsOptions, DockerGetContainerStatsResponseError, DockerGetContainerStatsResult, DockerResult } from './types';

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



const Docker = {
  DockerClient,
  createContainer,
  getContainers,
};
export default Docker;