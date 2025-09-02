import DockerClient from '../client';

test('getContainers', async () => {
  const client = new DockerClient();
  const containers = await client.getContainers();
  //console.log(JSON.stringify(containers, null, 2));
});

/*
test('createContainer', async () => {
  const client = new DockerClient();
  const container = await client.createContainer('alpine', {
    name: 'test-container',
    hostConfig: {
      autoRemove: true,
    }
  });
  console.log(JSON.stringify(container, null, 2));
});
*/

/*
test('getContainerStats', async () => {
  const client = new DockerClient();
  const response = await client.getContainerStats('postgresql', { stream: true });
  if(response.success?.stream){
    const stream = response.success.stream;
    const reader = stream.getReader();
    for(let i=0; i < 5; i++){
      const { done, value: stats } = await reader.read();
      if(done) break;
      console.log(JSON.stringify(stats, null, 2));
    }
    await reader.cancel();
  }
});
*/

/*
test('getImages', async () => {
  const client = new DockerClient();
  const images = await client.getImages();
  console.log(JSON.stringify(images, null, 2));
});
*/
