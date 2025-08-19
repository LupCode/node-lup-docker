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

Docker..getCpuInfo().then(cpuInfo => console.log("CPU Info: " + cpuInfo));
```

TypeScript:
```typescript
import lupSystem from 'lup-docker';

(async () => {
    console.log("CPU Info: ", await lupSystem.getCpuInfo());
    console.log("Drives: ", await lupSystem.getDrives()); // Array of drive objects
    console.log("GPU Info: ", await lupSystem.getGPUs());
    console.log("Memory Info: ", await lupSystem.getMemoryInfo());
    console.log("Network Interfaces: ", await lupSystem.getNetworkInterfaces());
    console.log("OS Info: ", await lupSystem.getOSInfo());
    console.log("Temperatures: ", await lupSystem.getTemperatures());
})();
```

Output:
```
CPU Info: {
    architecture: 'x64',
    coreCount: 12,
    endian: 'LE',
    name: '11th Gen Intel(R) Core(TM) i5-11600K @ 3.90GHz',
    speed: 3912,
    utilization: {
        overall: 0.20021299254526093,
        cores: [
            0.20253164556962025,
            0.19230769230769232,
            0.6025641025641025,
            0,
            0.3974358974358974,
            0.20253164556962025,
            0,
            0,
            0.20253164556962025,
            0,
            0.19480519480519481,
            0.4050632911392405
        ]
    }
}
Drives: [
    {
        filesystem: 'C:',
        mount: 'C:',
        type: 'ntfs',
        total: 1999519543296,
        utilization: {
            free: 470568960000,
            used: 1528950583296,
            percentage: 0.7646589844156682
        }
    },
    {
        filesystem: 'D:',
        mount: 'D:',
        type: 'ntfs',
        total: 1000203087872,
        utilization: {
            free: 917100240896,
            used: 83102846976,
            percentage: 0.08308597322250519
        }
    }
]
GPU Info: [
    {
        name: 'NVIDIA GeForce RTX 3060 Ti',
        status: 'ok',
        id: 'PCI\\VEN_10DE&DEV_2489&SUBSYS_884F1043&REV_A1\\4&2130FF93&0&0008',
        processor: 'NVIDIA GeForce RTX 3060 Ti',
        memory: 8589934592,
        driverDate: '14.05.2025 02:00:00',
        driverVersion: '32.0.15.7652',
        displayAttached: true,
        displayActive: true,
        utilization: {
            fanSpeed: 0.56,
            processing: 0.01,
            memory: 0,
            temperature: 51,
            powerDraw: 46.65
        }
    }
]
Memory Info: {
    size: 34249633792,
    utilization: {
        used: 22643089408,
        free: 11606544384,
        percentage: 0.6611191683249166
    },
    devices: [
        {
            manufacturer: 'Kingston',
            model: 'KF3200C16D4/16GX',
            bankName: 'BANK 0',
            size: 17179869184,
            busWidth: 64,
            maxClockSpeed: 2400,
            clockSpeed: 2400,
            voltage: 1.2,
            locator: 'Controller0-ChannelA-DIMM1',
            type: 'DDR4',
            transfersPerClockCycle: 2,
            bandwidth: 38400000000
        },
        {
            manufacturer: 'Kingston',
            model: 'KF3200C16D4/16GX',
            bankName: 'BANK 1',
            size: 17179869184,
            busWidth: 64,
            maxClockSpeed: 2400,
            clockSpeed: 2400,
            voltage: 1.2,
            locator: 'Controller0-ChannelB-DIMM1',
            type: 'DDR4',
            transfersPerClockCycle: 2,
            bandwidth: 38400000000
        }
    ],
    bandwidth: 76800000000
}
Network Interfaces: [
    {
        name: 'Loopback Pseudo-Interface 1',
        addresses: [ [Object], [Object] ],
        status: { operational: 'unknown', admin: true, cable: false },
        physical: true
    },
    {
        name: 'Ethernet',
        addresses: [],
        status: { operational: 'up', admin: true, cable: true },
        physical: true,
        speed: { bits: 1000000000, bytes: 125000000 },
        utilization: {
        receive: 0.000003003690036900369,
        transmit: 4.723247232472324e-7
        }
    }
]
OS Info: {
    name: 'Windows',
    version: '10.0.26100',
    architecture: 'x64',
    machine: 'x86_64',
    platform: 'win32',
    bits: 64,
    hostname: 'my-pc',
    uptime: 2025-07-25T09:38:27.126Z
}
Temperatures: {
    cpu: 45.2,
    gpu: 60.8,
}
```


## Considerations

### GPU Readings
For more detailed information on GPUs it is recommended to 
install the [nvidia-smi](https://developer.nvidia.com/nvidia-system-management-interface) tool.

### Docker
For [Docker](https://www.docker.com/) support, ensure that the Docker daemon is running and accessible.