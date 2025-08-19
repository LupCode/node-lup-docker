import DockerClient from './client';
import { DockerContainer, DockerCreateContainerOptions, DockerCreateContainerResponse, DockerCreateContainerResponseDockerError, DockerGetContainersOptions, DockerResult } from './types';

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
 * Returns a list of containers.
 * 
 * @param options Optional options for querying containers.
 * @returns List of containers or an error.
 */
export async function getContainers(options?: DockerGetContainersOptions): Promise<DockerResult<DockerContainer[]>> {
    return DOCKER.getContainers(options);
}




const Docker = {
  DockerClient,
  createContainer,
  getContainers,
};
export default Docker;