import { Collection } from "@discordjs/collection";
import { EventEmitter } from "events";
import { VoiceState } from "..";
import { Node, NodeOptions } from "./Node";
import { Player, PlayerOptions, Track, UnresolvedTrack } from "./Player";
import {
    LoadType,
    Plugin,
    Structure,
    TrackData,
    TrackEndEvent,
    TrackExceptionEvent,
    TrackStartEvent,
    TrackStuckEvent,
    TrackUtils,
    VoicePacket,
    VoiceServer,
    WebSocketClosedEvent,
} from "./Utils";

const REQUIRED_KEYS = ["event", "guildId", "op", "sessionId"];
function check(options: ManagerOptions) {
    if (!options) throw new TypeError("ManagerOptions must not be empty.");

    if (typeof options.send !== "function")
        throw new TypeError('Manager option "send" must be present and a function.');

    if (
        typeof options.clientId !== "undefined" &&
        !/^\d+$/.test(options.clientId)
    )
        throw new TypeError('Manager option "clientId" must be a non-empty string.');

    if (
        typeof options.nodes !== "undefined" &&
        !Array.isArray(options.nodes)
    )
        throw new TypeError('Manager option "nodes" must be a array.');

    if (
        typeof options.shards !== "undefined" &&
        typeof options.shards !== "number"
    )
        throw new TypeError('Manager option "shards" must be a number.');

    if (
        typeof options.plugins !== "undefined" &&
        !Array.isArray(options.plugins)
    )
        throw new TypeError('Manager option "plugins" must be a Plugin array.');

    if (
        typeof options.autoPlay !== "undefined" &&
        typeof options.autoPlay !== "boolean"
    )
        throw new TypeError('Manager option "autoPlay" must be a boolean.');

    if (
        typeof options.trackPartial !== "undefined" &&
        !Array.isArray(options.trackPartial)
    )
        throw new TypeError('Manager option "trackPartial" must be a string array.');

    if (
        typeof options.clientName !== "undefined" &&
        typeof options.clientName !== "string"
    )
        throw new TypeError('Manager option "clientName" must be a string.');

    if (
        typeof options.defaultSearchPlatform !== "undefined" &&
        typeof options.defaultSearchPlatform !== "string"
    )
        throw new TypeError('Manager option "defaultSearchPlatform" must be a string.');
}

export interface Manager {
    /**
     * @event Manager#nodeCreate
     */
    on(event: "nodeCreate", listener: (node: Node) => void): this;

    /**
     * @event Manager#nodeDestroy
     */
    on(event: "nodeDestroy", listener: (node: Node) => void): this;

    /**
     * @event Manager#nodeConnect
     */
    on(event: "nodeConnect", listener: (node: Node) => void): this;

    /**
     * @event Manager#nodeReconnect
     */
    on(event: "nodeReconnect", listener: (node: Node) => void): this;

    /**
     * @event Manager#nodeDisconnect
     */
    on(
        event: "nodeDisconnect",
        listener: (node: Node, reason: { code?: number; reason?: string }) => void
    ): this;

    /**
     * @event Manager#nodeError
     */
    on(event: "nodeError", listener: (node: Node, error: Error) => void): this;

    /**
     * @event Manager#nodeRaw
     */
    on(event: "nodeRaw", listener: (payload: unknown) => void): this;

    /**
     * @event Manager#playerCreate
     */
    on(event: "playerCreate", listener: (player: Player) => void): this;

    /**
     * @event Manager#playerDestroy
     */
    on(event: "playerDestroy", listener: (player: Player) => void): this;

    /**
     * @event Manager#queueEnd
     */
    on(
        event: "queueEnd",
        listener: (
            player: Player,
            track: Track | UnresolvedTrack,
            payload: TrackEndEvent
        ) => void
    ): this;

    /**
     * @event Manager#playerMove
     */
    on(
        event: "playerMove",
        listener: (player: Player, initChannel: string, newChannel: string) => void
    ): this;

    /**
     * @event Manager#playerDisconnect
     */
    on(
        event: "playerDisconnect",
        listener: (player: Player, oldChannel: string) => void
    ): this;

    /**
     * @event Manager#trackStart
     */
    on(
        event: "trackStart",
        listener: (player: Player, track: Track, payload: TrackStartEvent) => void
    ): this;

    /**
     * @event Manager#trackEnd
     */
    on(
        event: "trackEnd",
        listener: (player: Player, track: Track, payload: TrackEndEvent) => void
    ): this;

    /**
     * @event Manager#trackStuck
     */
    on(
        event: "trackStuck",
        listener: (player: Player, track: Track, payload: TrackStuckEvent) => void
    ): this;

    /**
     * @event Manager#trackError
     */
    on(
        event: "trackError",
        listener: (
            player: Player,
            track: Track | UnresolvedTrack,
            payload: TrackExceptionEvent
        ) => void
    ): this;


    /**
     * @event Manager#nodeReady
     */
    on(event: "nodeReady", listener: (node: Node) => void): this;

    /**
     * @event Manager#socketClosed
     */
    on(
        event: "socketClosed",
        listener: (player: Player, payload: WebSocketClosedEvent) => void
    ): this;
}

/**
 * @noInheritDoc
 */
export class Manager extends EventEmitter {
    public static readonly DEFAULT_SOURCES: Record<SearchPlatform, string> = {
        "youtube music": "ytmsearch",
        "youtube": "ytsearch",
        "soundcloud": "scsearch"
    }

    public readonly players = new Collection<string, Player>();
    public readonly nodes = new Collection<string, Node>();
    public readonly options: ManagerOptions;
    private initiated = false;

    public get leastUsedNode(): Collection<string, Node> {
        return this.nodes.filter((node) => node.connected)
            .sort((a, b) => b.calls - a.calls);
    }

    public get leastLoadNodes(): Collection<string, Node> {
        return this.nodes
            .filter((node) => node.connected)
            .sort((a, b) => {
                const aload = a.stats.cpu
                    ? (a.stats.cpu.systemLoad / a.stats.cpu.cores) * 100
                    : 0;
                const bload = b.stats.cpu
                    ? (b.stats.cpu.systemLoad / b.stats.cpu.cores) * 100
                    : 0;
                return aload - bload;
            });
    }

    /**
   * Initiates the Manager class.
   * @param options
   */
    constructor(options: ManagerOptions) {
        super();

        check(options);

        Structure.get("Player").init(this);
        Structure.get("Node").init(this);
        TrackUtils.init(this);

        if (options.trackPartial) {
            TrackUtils.setTrackPartial(options.trackPartial);
            delete options.trackPartial;
        }

        this.options = {
            plugins: [],
            nodes: [{ identifier: "default", host: "localhost" }],
            shards: 1,
            autoPlay: true,
            clientName: "sinsacord",
            defaultSearchPlatform: "youtube",
            ...options,
        };

        if (this.options.plugins) {
            for (const [index, plugin] of this.options.plugins.entries()) {
                if (!(plugin instanceof Plugin))
                    throw new RangeError(`Plugin at index ${index} does not extend Plugin.`);
                plugin.load(this);
            }
        }

        if (this.options.nodes) {
            for (const nodeOptions of this.options.nodes)
                new (Structure.get("Node"))(nodeOptions);
        }
    }

    /**
     * @param clientId
     */
    public init(clientId?: string): this {
        if (this.initiated) return this;
        if (typeof clientId !== "undefined") this.options.clientId = clientId;
        if (typeof this.options.clientId !== "string") throw new Error('"clientId" set is not type of "string"');
        if (!this.options.clientId)
            throw new Error(
                '"clientId" set is not type of "string"'
            )
        if (!this.options.clientId)
            throw new Error(
                '"clientId" is not set. Pass it in Manager#init() or as a option in the constructor.'
            );
        for (const node of this.nodes.values()) {
            try {
                node.connect();
            } catch (err) {
                this.emit("nodeError", node, err);
            }
        }

        this.initiated = true;
        return this;
    }
    /**
     * @param query
     * @param requester
     * @returns
     */

    public search(
        query: string | SearchQuery,
        requester?: unknown
    ): Promise<SearchResult> {
        return new Promise(async (resolve, reject) => {
            const node = this.leastUsedNode.first();
            if (!node) return reject(new Error("No available nodes"));

            const _query: SearchQuery = typeof query === "string" ? { query } : query;
            const _source = Manager.DEFAULT_SOURCES[_query.source ?? this.options.defaultSearchPlatform] ?? _query.source;

            let seacrh = _query.query;
            if (!/^https?:\/\//.test(seacrh)) {
                seacrh = `${_source}:${seacrh}`;
            }

            const res = await node
                .makeRequest<LavalinkResult>(`/v4/loadtracks?identifier=${encodeURIComponent(seacrh)}`)
                .catch((err) => reject(err));

            if (!res) {
                return reject(new Error("No results found"));
            }
            const result: SearchResult = {
                loadType: res.loadType,
                exception: res.exception ?? undefined,
                tracks: Array.isArray(res.data) 
                ? res.data.map((track: TrackData) => TrackUtils.build(track, requester)) 
                : [],
            };

            if (result.loadType === "playlist") {
                result.playlist = {
                  name: res.playlistInfo.name,
                  selectedTrack: res.playlistInfo.selectedTrack === -1 ? null :
                    TrackUtils.build(
                      res.data[res.playlistInfo.selectedTrack],
                      requester
                    ),
                  duration: result.tracks
                    .reduce((acc: number, cur: Track) => acc + (cur.duration || 0), 0),
                };
              }
            return resolve(result);
        })
    }
    /**
     * @param tracks
     */
    public decodeTracks(tracks: string[]): Promise<TrackData[]> {
        return new Promise(async (resolve, reject) => {
            const node = this.nodes.first();
            if (!node) return reject(new Error("No available nodes"));

            const res = await node.makeRequest<TrackData[]>(`/v4/decodetracks`, r => {
                r.method = "POST";
                r.body = JSON.stringify(tracks);
                r.headers!["Content-Type"] = "application/json";
            }).catch((err) => reject(err));

            if (!res) {
                return reject(new Error("No data returned from query."));
            }

            return resolve(res);
        })
    }
    /**
   * @param track
   */
    public async decodeTrack(track: string): Promise<TrackData> {
        const res = await this.decodeTracks([track]);
        return res[0];
    }
    /**
     * @param options
     */
    public create(options: PlayerOptions): Player {
        if (this.players.has(options.guild)) {
            return this.players.get(options.guild);
        }

        return new (Structure.get("Player"))(options);
    }
    /**
     * @param guild
     */
    public get(guild: string): Player | undefined {
        return this.players.get(guild);
    }
    /**
     * @param guild
     */
    public destroy(guild: string): void {
        this.players.delete(guild);
    }
    /**
     * @param options
     */
    public createNode(options: NodeOptions): Node {
        if (this.nodes.has(options.identifier || options.host)) {
            return this.nodes.get(options.identifier || options.host);
        }

        return new (Structure.get("Node"))(options);
    }
    /**
     * @param identifier
     */
    public destroyNode(identifier: string): void {
        const node = this.nodes.get(identifier);
        if (!node) return;
        node.destroy()
        this.nodes.delete(identifier)
    }
    /**
     * @param data
     */
    public updateVoiceState(data: VoicePacket | VoiceServer | VoiceState): void {
        if ("t" in data && !["VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(data.t)) return;
        const update: VoiceServer | VoiceState = "d" in data ? data.d : data;
        if (!update || !("token" in update) && !("session_id" in update)) return;

        const player = this.players.get(update.guild_id) as Player;
        if (!player) return;
        console.log("Update :", update)
        if ("token" in update) {
            player.voiceState.event = update;
        } else {
            if (update.user_id !== this.options.clientId) return;
            if (update.channel_id) {
                if (player.voiceChannel !== update.channel_id) {
                    this.emit("playerMove", player, player.voiceChannel, update.channel_id);
                }

                player.voiceState.sessionId = update.session_id;
                player.voiceChannel = update.channel_id
            } else {
                this.emit("playerDisconnect", player, player.voiceChannel);
                player.voiceChannel = null;
                player.voiceState = Object.assign({});
                player.pause(true);
            }

            if (REQUIRED_KEYS.every((k) => k in player.voiceState)) {
                player.node.send(player.voiceState);
            }
        }
    }
}

export interface Payload {
    op: number;
    d: {
        guild_id: string;
        channel_id: string | null;
        self_mute: boolean;
        self_deaf: boolean;
    };
}

export interface ManagerOptions {
    nodes?: NodeOptions[];
    clientId?: string;
    clientName?: string;
    shards?: number;
    plugins?: Plugin[];
    autoPlay?: boolean;
    trackPartial?: string[];
    defaultSearchPlatform?: SearchPlatform;
    /**
     * @param id
     * @param payload
     */
    send(id: string, payload: Payload): void;
}

export type SearchPlatform = "youtube" | "youtube music" | "soundcloud";

export interface SearchQuery {
    source?: SearchPlatform | string;
    query: string;
}

export interface SearchResult {
    loadType: LoadType;
    tracks: Track[];
    playlist?: PlaylistInfo;
    exception?: {
        message: string;
        severity: string;
    };
}

export interface PlaylistInfo {
    name: string;
    selectedTrack?: Track;
    duration: number;
}

export interface LavalinkResult {
    data: TrackData[];
    loadType: LoadType;
    exception?: {
        message: string;
        severity: string;
    };
    playlistInfo: {
        name: string;
        selectedTrack?: number;
    };
}