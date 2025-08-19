import DockerClient from '../client';

test('getContainers', async () => {
  const client = new DockerClient();
  const containers = await client.getContainers();
  //console.log(JSON.stringify(containers, null, 2));
});

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
