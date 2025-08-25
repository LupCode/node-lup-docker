import { decodeDockerContainerStats } from "./convert";
import { DockerContainerStats } from "./types";


export class DockerStatsStream extends ReadableStream<DockerContainerStats> {
    constructor(source: ReadableStream<Uint8Array>) {
        let reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>;

        super({

            async start(controller){
                try {
                    let readerDone = false;
                    reader = source.getReader();
                    const decoder = new TextDecoder('utf-8');
                    let curr = '';
                    while(!readerDone){
                        const { done, value } = await reader.read();
                        readerDone = readerDone || done;
                        if(!value) continue;

                        curr += decoder.decode(value, { stream: true });
                        let idx: number;
                        while((idx = curr.indexOf('\n')) >= 0){
                            const line = curr.slice(0, idx);
                            curr = curr.slice(idx + 1);
                            const statsJson = JSON.parse(line);
                            controller.enqueue(decodeDockerContainerStats(statsJson));
                        }
                    }
                } finally {
                    controller.close();
                }
            },

            async cancel(reason){
                if(reader) await reader.cancel(reason);
            },

        });
    }
}


export type DockerLogStreamType = 'stderr' | 'stdin' | 'stdout';


export type DockerLogStreamCallback = (type: DockerLogStreamType, data: string) => void;



/*
export class DockerLogStream {
    private rawStream: NodeJS.ReadableStream;
    private closed: boolean = false;
    private onClose: () => void;


    constructor(contentType: string, rawStream: NodeJS.ReadableStream, onClose: () => void, onReceive: DockerLogStreamCallback){
        this.rawStream = rawStream;
        this.onClose = onClose;

        this.rawStream.on('end', () => {
            this.onClose();
        });


        // any other type of stream
        if(contentType !== 'application/vnd.docker.multiplexed-stream'){
            this.rawStream.on('data', (chunk: Buffer) => {
                onReceive('stdout', chunk.toString('utf8'));
            });
            return;
        }


        // Docker Multi-Stream
        let currType: DockerLogStreamType | null = null; // if null read header
        let currBuf: Buffer = Buffer.alloc(0);
        let currOffset = 0;
        let currPayloadSize: number = 0;

        this.rawStream.on('data', (chunk: Buffer) => {
            if(currOffset < currBuf.length){
                currBuf = Buffer.concat([currBuf, chunk]);
            } else {
                currBuf = chunk;
                currOffset = 0;
            }

            while(true){
                if(!currType){
                    // read header
                    if(currBuf.length - currOffset >= 8){ // header has 8 bytes
                        switch(currBuf[currOffset]){
                            case 0: currType = 'stdin'; break;
                            case 1: currType = 'stdout'; break;
                            case 2: currType = 'stderr'; break;
                            default: currType = 'stdout'; break;
                        }
                        currPayloadSize = currBuf.readUInt32BE(currOffset + 4); // read length of payload
                        currOffset += 8; // move past header
                    } else {
                        break;
                    }
                }

                if(currBuf.length - currOffset >= currPayloadSize){
                    const end = currOffset + currPayloadSize;
                    const payload = currBuf.toString('utf8', currOffset, end);
                    onReceive(currType, payload);
                    currBuf = (currBuf.length > end) ? currBuf.subarray(end) : Buffer.alloc(0);
                    currType = null;
                    currPayloadSize = 0;
                    currOffset = 0;
                } else {
                    break;
                }
            }
        });
    }

    public close(): void {
        if(this.closed) return;
        this.closed = true;
        this.rawStream.pause();
        this.onClose();
    }

    public isClosed(): boolean {
        return this.closed;
    }
}*/

export type DockerLogStreamChunk = {

    /** Type of the stream (stdout, stderr, stdin) */
    type: DockerLogStreamType;

    /** Data of the stream */
    data: string;
};

export class DockerLogStream extends ReadableStream<DockerLogStreamChunk> {

    constructor(contentType: string, source: ReadableStream<Uint8Array>) {
        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

        super({

            async start(controller) {
                try {
                    let readerDone = false;
                    reader = source.getReader();
                    const decoder = new TextDecoder('utf-8');

                    // any other type of stream
                    if(contentType !== 'application/vnd.docker.multiplexed-stream'){
                        while(!readerDone){
                            const { done, value } = await reader.read();
                            readerDone = readerDone || done;
                            if(!value) continue;

                            controller.enqueue({ type: 'stdout', data: decoder.decode(value, { stream: true }) });
                        }
                        controller.close();
                        return;
                    }


                    // Docker Multi-Stream
                    let currType: DockerLogStreamType | null = null; // if null read header
                    let currBuf: Buffer = Buffer.alloc(0);
                    let currOffset = 0;
                    let currPayloadSize: number = 0;

                    while(!readerDone){
                        const { done, value: chunk } = await reader.read();
                        readerDone = readerDone || done;
                        if(!chunk) continue;
                        
                        if(currOffset < currBuf.length){
                            currBuf = Buffer.concat([currBuf, chunk]);
                        } else {
                            currBuf = Buffer.from(chunk);
                            currOffset = 0;
                        }

                        while(true){
                            if(!currType){
                                // read header
                                if(currBuf.length - currOffset >= 8){ // header has 8 bytes
                                    switch(currBuf[currOffset]){
                                        case 0: currType = 'stdin'; break;
                                        case 1: currType = 'stdout'; break;
                                        case 2: currType = 'stderr'; break;
                                        default: currType = 'stdout'; break;
                                    }
                                    currPayloadSize = currBuf.readUInt32BE(currOffset + 4); // read length of payload
                                    currOffset += 8; // move past header
                                } else {
                                    break;
                                }
                            }

                            if(currBuf.length - currOffset >= currPayloadSize){
                                const end = currOffset + currPayloadSize;
                                const payload = currBuf.toString('utf8', currOffset, end);
                                controller.enqueue({ type: currType, data: payload });
                                currBuf = (currBuf.length > end) ? currBuf.subarray(end) : Buffer.alloc(0);
                                currType = null;
                                currPayloadSize = 0;
                                currOffset = 0;
                            } else {
                                break;
                            }
                        }
                    }
                } finally {
                    controller.close();
                }
            },

            async cancel(reason) {
                if(reader) await reader.cancel(reason);
            },

        });
    }
}