import WebSocket from "ws";
import { Dispatcher, Pool } from "undici";
import { Manager } from "./Manager";
import { Player, Track, UnresolvedTrack } from "./Player";
import {
    PlayerEvent,
    PlayerEvents,
    Structure,
    TrackEndEvent,
    TrackExceptionEvent,
    TrackStartEvent,
    TrackStuckEvent,
    WebSocketClosedEvent,
} from "./Utils";
import axios from "axios";

function check(options: NodeOptions) {
    if (!options) throw new TypeError("NodeOptions must not be empty.");

    if (
        typeof options.host !== "string" ||
        !/.+/.test(options.host)
    )
        throw new TypeError('Node option "host" must be present and be a non-empty string.');

    if (
        typeof options.port !== "undefined" &&
        typeof options.port !== "number"
    )
        throw new TypeError('Node option "port" must be a number.');

    if (
        typeof options.password !== "undefined" &&
        (typeof options.password !== "string" ||
            !/.+/.test(options.password))
    )
        throw new TypeError('Node option "password" must be a non-empty string.');

    if (
        typeof options.secure !== "undefined" &&
        typeof options.secure !== "boolean"
    )
        throw new TypeError('Node option "secure" must be a boolean.');

    if (
        typeof options.identifier !== "undefined" &&
        typeof options.identifier !== "string"
    )
        throw new TypeError('Node option "identifier" must be a non-empty string.');

    if (
        typeof options.retryAmount !== "undefined" &&
        typeof options.retryAmount !== "number"
    )
        throw new TypeError('Node option "retryAmount" must be a number.');

    if (
        typeof options.retryDelay !== "undefined" &&
        typeof options.retryDelay !== "number"
    )
        throw new TypeError('Node option "retryDelay" must be a number.');

    if (
        typeof options.requestTimeout !== "undefined" &&
        typeof options.requestTimeout !== "number"
    )
        throw new TypeError('Node option "requestTimeout" must be a number.');
}


export class Node {
    public socket: WebSocket | null = null;
    public http: Pool;
    public calls = 0;
    public stats: NodeStats;
    public manager: Manager;
    public sessionId : string

    private static _manager: Manager;
    private reconnectTimeout?: NodeJS.Timeout;
    private reconnectAttempts = 1;

    public get connected(): boolean {
        if (!this.socket) return false;
        return this.socket.readyState === WebSocket.OPEN;
        
    }

    public get address(): string {
        return `${this.options.host}:${this.options.port}`;
    }

    /** @hidden */
    public static init(manager: Manager): void {
        this._manager = manager;
    }

    /**
     * @param options
     */
    constructor(public options: NodeOptions) {
        if (!this.manager) this.manager = Structure.get("Node")._manager
        if (!this.manager) throw new RangeError("Manager has not been initiated.");
        if (this.manager.nodes.has(options.identifier || options.host)) {
            return this.manager.nodes.get(options.identifier || options.host)!;
        }

        check(options);

        this.options = {
            port: 2333,
            password: "youshallnotpass",
            secure: false,
            retryAmount: 5,
            retryDelay: 30e3,
            ...options,
        };

        

        this.http = new Pool(`http${this.options.secure ? "s" : ""}://${this.address}`, this.options.poolOptions);
        this.options.identifier = options.identifier || this.options.host;
        this.stats = {
            players: 0,
            playingPlayers: 0,
            uptime: 0,
            memory: {
                free: 0,
                used: 0,
                allocated: 0,
                reservable: 0,
            },
            cpu: {
                cores: 0,
                systemLoad: 0,
                lavalinkLoad: 0,
            },
            frameStats: {
                sent: 0,
                nulled: 0,
                deficit: 0,
            }
        }

        this.manager.nodes.set(this.options.identifier, this);
        this.manager.emit("nodeCreate", this);
    }

    public connect(): void {
        if (this.connected) return;

        const headers = {
            Authorization: this.options.password,
            "Num-Shards": String(this.manager.options.shards),
            "User-Id": this.manager.options.clientId,
            "Client-Name": this.manager.options.clientName,
        };

        this.socket = new WebSocket(`ws${this.options.secure ? "s" : ""}://${this.address}/v4/websocket`, { headers });
        this.socket.on("open", this.open.bind(this));
        this.socket.on("close", this.close.bind(this));
        this.socket.on("message", this.message.bind(this));
        this.socket.on("error", this.error.bind(this));
    }

    public destroy(): void {
        if (!this.connected) return;
        const players = this.manager.players.filter(x => x.node === this);
        if (players.size) players.forEach(x => x.destroy());

        this.socket?.close(1000, "destroy");
        this.socket?.removeAllListeners();
        this.socket = null;

        this.reconnectAttempts = 1;
        clearTimeout(this.reconnectTimeout!);

        this.manager.emit("nodeDestroy", this);
        this.manager.destroyNode(this.options.identifier!);
    }

    /**
     * @param endpoint
     * @param modify 
     * @returns
     */
    public async makeRequest<T>(endpoint: string, modify?: ModifyRequest): Promise<T> {
        const options: Dispatcher.RequestOptions = {
          path: `/${endpoint.replace(/^\//gm, "")}`,
          method: "GET",
          headers: {
            Authorization: this.options.password
          },
          headersTimeout: this.options.requestTimeout,
        }
      
        modify?.(options);
      
        const request = await this.http.request(options);
        this.calls++;
      
        return await request.body.json() as T;
      }

    /**
     * Sends data to the Node.
     * @param data
     */
    public send(data: any): Promise<boolean> {
        console.log(data)
        return new Promise((resolve, reject) => {
            if (!this.connected) return resolve(false);
            if (!data || !JSON.stringify(data).startsWith("{")) {
                return reject(false)
            }
            const headers =  {
                Authorization : this.options.password,
                "Content-Type" : "application/json"
            }
            if(data.op == "value"){
                axios.patch(`http://${this.address}/v4/sessions/${this.sessionId}/players/${data.guildId}`, {
                    valume : data.valume
                }, {headers}).catch((e) => {
                    console.log(e)
                })
            }
            
            if(data.op == "equalizer"){
                axios.patch(`http://${this.address}/v4/sessions/${this.sessionId}/players/${data.guildId}`, {
                    bands : data.bands
                }, {headers}).catch((e) => {
                    console.log(e)
                })
            }
            if(data.op == "play"){
                axios.patch(`http://${this.address}/v4/sessions/${this.sessionId}/players/${data.guildId}?noReplace=true`, JSON.stringify({
                    track : {
                        encoded : data.track,
                        info: {
                            identifier : data.identifier
                        }
                    }
                }), {headers}).catch((e) => {
                    console.log(e)
                }).then(async(res) => {
                })
            }

            if(data.op == "playerUpdate"){
        
            }

            // this.socket?.send(JSON.stringify(data), (error) => {
            //     if (error) return reject(error);
            //     return resolve(true);
            // })

        });
    }

    

    private reconnect(): void {
        this.reconnectTimeout = setTimeout(() => {
            if (this.reconnectAttempts >= this.options.retryAmount!) {
                const error = new Error(`Unable to connect after ${this.options.retryAmount} attempts.`);
                this.manager.emit("nodeError", this, error);
                return this.destroy();
            }

            this.socket?.removeAllListeners();
            this.socket = null;
            this.manager.emit("nodeReconnect", this);
            this.connect();
            this.reconnectAttempts++;
        }, this.options.retryDelay);
    }

    protected open(): void {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.manager.emit("nodeConnect", this);
    }

    protected close(code: number, reason: string): void {
        this.manager.emit("nodeDisconnect", this, { code, reason });
        if (code !== 1000 || reason !== "destroy") this.reconnect();
    }

    protected error(error: Error): void {
        if (!error) return;
        this.manager.emit("nodeError", this, error);
    }

    protected message(d: Buffer | string): void {
        if (Array.isArray(d)) d = Buffer.concat(d);
        else if (d instanceof ArrayBuffer) d = Buffer.from(d);

        const payload = JSON.parse(d.toString());

        if (!payload.op) return;
        this.manager.emit("nodeRaw", payload);

        switch (payload.op) {
            case "stats":
                delete payload.op;
                this.stats = ({ ...payload } as unknown) as NodeStats;
                break;
            case "playerUpdate":
                const player = this.manager.players.get(payload.guildId);
                if (player) player.position = payload.state.position || 0;
                break;
            case "event":
                this.handleEvent(payload);
                break;
            case "ready":
                this.manager.emit("nodeReady", this);
                this.sessionId = payload.sessionId
                break;
            default:
                this.manager.emit(
                    "nodeError",
                    this,
                    new Error(`Unexpected op "${payload.op}" with data: ${payload}`)
                );
                return;
        }
    }

    protected handleEvent(payload: PlayerEvent & PlayerEvents): void {
        if (!payload.guildId) return;

        const player = this.manager.players.get(payload.guildId);
        if (!player) return;

        const track = player.queue.current;
        const type = payload.type;

        if (payload.type === "TrackStartEvent") {
            this.trackStart(player, track as Track, payload);
        } else if (payload.type === "TrackEndEvent") {
            this.trackEnd(player, track as Track, payload);
        } else if (payload.type === "TrackStuckEvent") {
            this.trackStuck(player, track as Track, payload);
        } else if (payload.type === "TrackExceptionEvent") {
            this.trackError(player, track, payload);
        } else if (payload.type === "WebSocketClosedEvent") {
            this.socketClosed(player, payload);
        } else {
            const error = new Error(`Node#event unknown event '${type}'.`);
            this.manager.emit("nodeError", this, error);
        }
    }

    protected trackStart(player: Player, track: Track, payload: TrackStartEvent): void {
        player.playing = true;
        player.paused = false;
        this.manager.emit("trackStart", player, track, payload);
    }

    protected trackEnd(player: Player, track: Track, payload: TrackEndEvent): void {
        // If a track had an error while starting
        if (["LOAD_FAILED", "CLEAN_UP"].includes(payload.reason)) {
            player.queue.previous = player.queue.current;
            player.queue.current = player.queue.shift();

            if (!player.queue.current) return this.queueEnd(player, track, payload);

            this.manager.emit("trackEnd", player, track, payload);
            if (this.manager.options.autoPlay) player.play();
            return;
        }

        // If a track was forcibly played
        if (payload.reason === "REPLACED") {
            this.manager.emit("trackEnd", player, track, payload);
            return;
        }

        // If a track ended and is track repeating
        if (track && player.trackRepeat) {
            if (payload.reason === "STOPPED") {
                player.queue.previous = player.queue.current;
                player.queue.current = player.queue.shift();
            }

            if (!player.queue.current) return this.queueEnd(player, track, payload);

            this.manager.emit("trackEnd", player, track, payload);
            if (this.manager.options.autoPlay) player.play();
            return;
        }

        // If a track ended and is track repeating
        if (track && player.queueRepeat) {
            player.queue.previous = player.queue.current;

            if (payload.reason === "STOPPED") {
                player.queue.current = player.queue.shift();
                if (!player.queue.current) return this.queueEnd(player, track, payload);
            } else {
                player.queue.add(player.queue.current);
                player.queue.current = player.queue.shift();
            }

            this.manager.emit("trackEnd", player, track, payload);
            if (this.manager.options.autoPlay) player.play();
            return;
        }

        // If there is another song in the queue
        if (player.queue.length) {
            player.queue.previous = player.queue.current;
            player.queue.current = player.queue.shift();

            this.manager.emit("trackEnd", player, track, payload);
            if (this.manager.options.autoPlay) player.play();
            return;
        }

        // If there are no songs in the queue
        if (!player.queue.length) return this.queueEnd(player, track, payload);
    }

    protected queueEnd(player: Player, track: Track, payload: TrackEndEvent): void {
        player.queue.current = null;
        player.playing = false;
        this.manager.emit("queueEnd", player, track, payload);
    }

    protected trackStuck(player: Player, track: Track, payload: TrackStuckEvent): void {
        player.stop();
        this.manager.emit("trackStuck", player, track, payload);
    }

    protected trackError(
        player: Player,
        track: Track | UnresolvedTrack,
        payload: TrackExceptionEvent
    ): void {
        player.stop();
        this.manager.emit("trackError", player, track, payload);
    }

    protected socketClosed(player: Player, payload: WebSocketClosedEvent): void {
        this.manager.emit("socketClosed", player, payload);
    }
}
export type ModifyRequest = (options: Dispatcher.RequestOptions) => void;

export interface NodeOptions {
    host: string;
    port?: number;
    password?: string;
    secure?: boolean;
    identifier?: string;
    retryAmount?: number;
    retryDelay?: number;
    requestTimeout?: number;
    poolOptions?: Pool.Options;
}
export interface NodeStats {
    players: number;
    playingPlayers: number;
    uptime: number;
    memory: MemoryStats;
    cpu: CPUStats;
    frameStats: FrameStats;
}

export interface MemoryStats {
    free: number;
    used: number;
    allocated: number;
    reservable: number;
}

export interface CPUStats {
    cores: number;
    systemLoad: number;
    lavalinkLoad: number;
}

export interface FrameStats {
    sent?: number;
    nulled?: number;
    deficit?: number;
}