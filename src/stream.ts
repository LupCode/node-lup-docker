/* eslint max-classes-per-file: ["error", { ignoreExpressions: true }] */

import { decodeDockerContainerStats } from './convert';
import { DockerContainerStats } from './types';

export type DockerLogStreamType = 'stderr' | 'stdin' | 'stdout';

export type DockerLogStreamCallback = (type: DockerLogStreamType, data: string) => void;

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
          if (contentType !== 'application/vnd.docker.multiplexed-stream') {
            while (!readerDone) {
              const { done, value } = await reader.read();
              readerDone = readerDone || done;
              if (!value) continue;

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

          while (!readerDone) {
            const { done, value: chunk } = await reader.read();
            readerDone = readerDone || done;
            if (!chunk) continue;

            if (currOffset < currBuf.length) {
              currBuf = Buffer.concat([currBuf, chunk]);
            } else {
              currBuf = Buffer.from(chunk);
              currOffset = 0;
            }

            while (true) {
              if (!currType) {
                // read header
                if (currBuf.length - currOffset >= 8) {
                  // header has 8 bytes
                  switch (currBuf[currOffset]) {
                    case 0:
                      currType = 'stdin';
                      break;
                    case 1:
                      currType = 'stdout';
                      break;
                    case 2:
                      currType = 'stderr';
                      break;
                    default:
                      currType = 'stdout';
                      break;
                  }
                  currPayloadSize = currBuf.readUInt32BE(currOffset + 4); // read length of payload
                  currOffset += 8; // move past header
                } else {
                  break;
                }
              }

              if (currBuf.length - currOffset >= currPayloadSize) {
                const end = currOffset + currPayloadSize;
                const payload = currBuf.toString('utf8', currOffset, end);
                controller.enqueue({ type: currType, data: payload });
                currBuf = currBuf.length > end ? currBuf.subarray(end) : Buffer.alloc(0);
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
        if (reader) await reader.cancel(reason);
      },
    });
  }
}

export class DockerStatsStream extends ReadableStream<DockerContainerStats> {
  constructor(source: ReadableStream<Uint8Array>) {
    let reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>;

    super({
      async start(controller) {
        try {
          let readerDone = false;
          reader = source.getReader();
          const decoder = new TextDecoder('utf-8');
          let curr = '';
          while (!readerDone) {
            const { done, value } = await reader.read();
            readerDone = readerDone || done;
            if (!value) continue;

            curr += decoder.decode(value, { stream: true });
            let idx: number;
            while (true) {
              idx = curr.indexOf('\n');
              if (idx < 0) break;
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

      async cancel(reason) {
        if (reader) await reader.cancel(reason);
      },
    });
  }
}

export class DockerStatsStreamReader {
  private reader: ReadableStreamDefaultReader<DockerContainerStats>;
  private closed: boolean = false;
  private callbacks: ((stats: DockerContainerStats) => void)[] = [];
  private cancelAutoReadCallbacks: (() => void)[] = [];

  constructor(stream: DockerStatsStream) {
    this.reader = stream.getReader();
  }

  private async autoReadLoop() {
    while (!this.closed && this.cancelAutoReadCallbacks.length === 0) {
      const { done } = await this.next(); // important to use own method because it invokes the callbacks
      if (done) break;
    }
    this.callbacks = [];
    this.cancelAutoReadCallbacks.forEach((callback) => callback());
    this.cancelAutoReadCallbacks = [];
  }

  /**
   * Adds a callback to be called with each new stats object
   * and starts the auto-read mode if not already running.
   *
   * @param callback The callback to add.
   */
  public addAutoReadCallback(callback: (stats: DockerContainerStats) => void): void {
    if (this.closed) throw new Error('Reader is already closed');
    this.callbacks.push(callback);
    if (this.callbacks.length === 1) this.autoReadLoop();
  }

  /**
   * Cancels the auto-read mode and waits for any ongoing reads to complete.
   * Clears all callbacks added through the `addAutoReadCallback` method.
   *
   * @returns A promise that resolves when the auto-read mode is cancelled and all ongoing reads are complete.
   */
  public async cancelAutoRead(): Promise<void> {
    if (this.callbacks.length === 0) return;
    return new Promise((resolve) => {
      this.cancelAutoReadCallbacks.push(resolve);
    });
  }

  /**
   * Closes the stream and releases any resources.
   */
  public async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    this.callbacks = [];
    this.cancelAutoReadCallbacks.forEach((callback) => callback());
    this.cancelAutoReadCallbacks = [];

    return this.reader.cancel();
  }

  /**
   * Checks if the stream is closed.
   *
   * @returns True if the stream is closed, false otherwise.
   */
  public isClosed(): boolean {
    return this.closed;
  }

  /**
   * Reads the next stats object from the stream.
   *
   * @returns Object containing the done status and the next stats object, if available.
   */
  public async next(): Promise<{ done: boolean; stats?: DockerContainerStats }> {
    if (this.closed) return { done: true };
    const { done, value } = await this.reader.read();
    if (done) this.close();
    if (value) this.callbacks.forEach((callback) => callback(value));
    return { done, stats: value };
  }
}
