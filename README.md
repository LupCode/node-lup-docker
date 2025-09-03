![GitHub package.json version](https://img.shields.io/github/package-json/v/LupCode/node-lup-docker)
![npm bundle size](https://img.shields.io/bundlephobia/min/lup-docker)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/LupCode/node-lup-docker/on-push.yml?branch=main)
![NPM](https://img.shields.io/npm/l/lup-docker)

# lup-docker
NodeJS library to interact with the Docker engine.

## Example

JavaScript:
```javascript
const Docker = require('lup-docker');

// List of all containers
const containers = await Docker.getContainers().then(result => result.success || []);
console.log(containers);

// Stream of a containers utilization stats
const statsStream = await Docker.getContainerStatsStream('busybox').then(result => result.success);
if(statsStream){
    const statsReader = statsStream.getReader();
    while(true){
        const { done, value } = await statsReader.read();
        if(done) break;

        // Process the stats data
        console.log(value);
    }
}
```

TypeScript:
```typescript
import lupSystem from 'lup-docker';

// List of all containers
const containers = await Docker.getContainers().then(result => result.success || []);
console.log(containers);

// Stream of a containers utilization stats
const statsStream = await Docker.getContainerStatsStream('busybox').then(result => result.success);
if(statsStream){
    const statsReader = statsStream.getReader();
    while(true){
        const { done, value } = await statsReader.read();
        if(done) break;

        // Process the stats data
        console.log(value);
    }
}
```