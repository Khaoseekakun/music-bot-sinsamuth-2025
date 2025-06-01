import { Manager, SearchQuery, SearchResult } from "./Manager";
import { Node } from "./Node";
import { Queue } from "./Queue";
import { Sizes, State, Structure, TrackUtils, VoiceState } from "./Utils";

function check(options: PlayerOptions) {
    if (!options) throw new TypeError("PlayerOptions must not be empty.");

    if (!/^\d+$/.test(options.guild))
        throw new TypeError(
            'Player option "guild" must be present and be a non-empty string.'
        );

    if (options.textChannel && !/^\d+$/.test(options.textChannel))
        throw new TypeError(
            'Player option "textChannel" must be a non-empty string.'
        );

    if (options.voiceChannel && !/^\d+$/.test(options.voiceChannel))
        throw new TypeError(
            'Player option "voiceChannel" must be a non-empty string.'
        );

    if (options.node && typeof options.node !== "string")
        throw new TypeError('Player option "node" must be a non-empty string.');

    if (
        typeof options.volume !== "undefined" &&
        typeof options.volume !== "number"
    )
        throw new TypeError('Player option "volume" must be a number.');

    if (
        typeof options.selfMute !== "undefined" &&
        typeof options.selfMute !== "boolean"
    )
        throw new TypeError('Player option "selfMute" must be a boolean.');

    if (
        typeof options.selfDeafen !== "undefined" &&
        typeof options.selfDeafen !== "boolean"
    )
        throw new TypeError('Player option "selfDeafen" must be a boolean.');
}


export class Player {
    public readonly queue = new (Structure.get("Queue"))() as Queue;
    public trackRepeat = false;
    public queueRepeat = false;
    public position = 0;
    public playing = false;
    public paused = false;
    public volume: number;
    public node: Node;
    public guild: string;
    public voiceChannel: string | null = null;
    public textChannel: string | null = null;
    public state: State = "DISCONNECTED";
    public bands = new Array<number>(15).fill(0.0);
    public voiceState: VoiceState;
    public manager: Manager;
    private static _manager: Manager;
    private readonly data: Record<string, unknown> = {};

    /**
     * @param key
     * @param value
     */
    public set(key: string, value: unknown): void {
        this.data[key] = value;
    }

    /**
     * @param key
     */
    public get<T>(key: string): T {
        return this.data[key] as T;
    }

    /** @hidden */
    public static init(manager: Manager): void {
        this._manager = manager;
    }

    /**
     * @param options
     */

    constructor(public options: PlayerOptions) {
        if (!this.manager) this.manager = Structure.get("Player")._manager;
        if (!this.manager) throw new RangeError("Manager has not been initiated.");
        if (this.manager.players.has(options.guild)) {
            return this.manager.players.get(options.guild) as Player;
        }

        check(options);

        this.guild = options.guild;
        this.voiceState = Object.assign({ op: "voiceUpdate", guildId: options.guild });

        if (options.voiceChannel) this.voiceChannel = options.voiceChannel;
        if (options.textChannel) this.textChannel = options.textChannel;

        const node = this.manager.nodes.get(options.node as string);
        this.node = node ?? this.manager.leastLoadNodes.first() as Node;

        if (!this.node) throw new RangeError("No available nodes.");

        this.manager.players.set(options.guild, this);
        this.manager.emit("playerCreate", this);
        this.setVolume(options.volume ?? 100);
        const bands = new Array(4)
            .fill(null)
            .map((_, i) =>
                ({ band: i, gain: 0.15 })
            );
        this.setEQ(...bands);
    }

    /**
     * @param query
     * @param requester
     */
    public search(
        query: string | SearchQuery,
        requester?: unknown
    ): Promise<SearchResult> {
        return this.manager.search(query, requester);
    }

    /**
     * @param bands
     */

    public setEQ(...bands: EqualizerBand[]): this {
        if (Array.isArray(bands[0])) bands = bands[0] as unknown as EqualizerBand[];
        if (!bands.length || !bands.every((band) => JSON.stringify(Object.keys(band).sort()) === '["band","gain"]')) throw new RangeError("Bands must be a non-empty object array containing 'band' and 'gain' properties.");

        for (const { band, gain } of bands) this.bands[band] = gain;

        this.node.send({
            op: "equalizer",
            guildId: this.guild,
            bands: this.bands.map((gain, band) => ({ band, gain }))
        })

        return this
    }

    public clearEQ(): this {
        this.bands = new Array(15).fill(0.0);

        this.node.send({
            op: "equalizer",
            guildId: this.guild,
            bands: this.bands.map((gain, band) => ({ band, gain }))
        });

        return this;
    }

    public connect(): this {
        if (!this.voiceChannel) throw new RangeError("Voice channel ID not set.");
        this.state = "CONNECTING";

        this.manager.options.send(this.guild, {
            op: 4,
            d: {
                guild_id: this.guild,
                channel_id: this.voiceChannel,
                self_mute: this.options.selfMute ?? false,
                self_deaf: this.options.selfDeafen ?? false
            }
        })

        this.state = "CONNECTED";
        return this;
    }

    public disconnect(): this {
        if (this.voiceChannel === null) return this;
        this.state = "DISCONNECTING";

        this.pause(true);
        this.manager.options.send(this.guild, {
            op: 4,
            d: {
                guild_id: this.guild,
                channel_id: null,
                self_mute: false,
                self_deaf: false,
            },
        });

        this.voiceChannel = null;
        this.state = "DISCONNECTED";
        return this;
    }
    public destroy(disconnect = true): void {
        this.state = "DESTROYING";
        if (disconnect) {
            this.disconnect();
        }

        this.node.send({
            op: "destroy",
            guildId: this.guild,
        });

        this.manager.emit("playerDestroy", this);
        this.manager.players.delete(this.guild);
    }

    /**
    * @param channel
    */
    public setVoiceChannel(channel: string): this {
        if (typeof channel !== "string")
            throw new TypeError("Channel must be a non-empty string.");

        this.voiceChannel = channel;
        this.connect();
        return this;
    }

    /**
     * @param channel
     */
    public setTextChannel(channel: string): this {
        if (typeof channel !== "string")
            throw new TypeError("Channel must be a non-empty string.");

        this.textChannel = channel;
        return this;
    }

    public async play(): Promise<void>;

    /**
     * @param track
     */
    public async play(track: Track | UnresolvedTrack): Promise<void>;

    /**
     * @param options
     */
    public async play(options: PlayOptions): Promise<void>;
    /**
     * @param track
     * @param options
     */
    public async play(track: Track | UnresolvedTrack, options: PlayOptions): Promise<void>;
    public async play(optionsOrTrack?: PlayOptions | Track | UnresolvedTrack, playOptions?: PlayOptions): Promise<void> {
        if (
            typeof optionsOrTrack !== "undefined" &&
            TrackUtils.validate(optionsOrTrack)
        ) {
            if (this.queue.current) this.queue.previous = this.queue.current;
            this.queue.current = optionsOrTrack as Track;
        }
        if (!this.queue.current) throw new RangeError("No current track.");

        const finalOptions = playOptions
            ? playOptions
            : ["startTime", "endTime", "noReplace"].every((v) =>
                Object.keys(optionsOrTrack || {}).includes(v)
            )
                ? (optionsOrTrack as PlayOptions)
                : {};

        if (TrackUtils.isUnresolvedTrack(this.queue.current)) {
            try {
                this.queue.current = await TrackUtils.getClosestTrack(this.queue.current as UnresolvedTrack);
            } catch (error) {
                this.manager.emit("trackError", this, this.queue.current, error);
                if (this.queue[0]) return this.play(this.queue[0]);
                return;
            }
        }
        const options = {
            op: "play",
            guildId: this.guild,
            track: this.queue.current?.track ?? null,
            identifier : this.queue.current?.identifier ?? null,
            userData : this.queue.current?.requester ?? null,
            ...finalOptions,
        };

        if (typeof options.track !== "string") {
            options.track = (options.track as Track).track;
        }
        await this.node.send(options);
    }

    /**
   * @param volume
   */
    public setVolume(volume: number): this {
        volume = Number(volume);
        if (isNaN(volume)) throw new TypeError("Volume must be a number.");
        this.volume = Math.max(Math.min(volume, 1000), 0);
        this.node.send({
            op: "volume",
            guildId: this.guild,
            volume: this.volume,
        });
        return this;
    }

    /**
     * @param repeat
     */
    public setTrackRepeat(repeat: boolean): this {
        if (typeof repeat !== "boolean")
            throw new TypeError('Repeat can only be "true" or "false".');
        if (repeat) {
            this.trackRepeat = true;
            this.queueRepeat = false;
        } else {
            this.trackRepeat = false;
            this.queueRepeat = false;
        }
        return this;
    }

    /**.
     * @param repeat
     */
    public setQueueRepeat(repeat: boolean): this {
        if (typeof repeat !== "boolean")
            throw new TypeError('Repeat can only be "true" or "false".');
        if (repeat) {
            this.trackRepeat = false;
            this.queueRepeat = true;
        } else {
            this.trackRepeat = false;
            this.queueRepeat = false;
        }
        return this;
    }

    public stop(amount?: number): this {
        if (typeof amount === "number" && amount > 1) {
            if (amount > this.queue.length) throw new RangeError("Cannot skip more than the queue length.");
            this.queue.splice(0, amount - 1);
        }
        this.node.send({
            op: "stop",
            guildId: this.guild,
        });
        return this;
    }

    /**
     * @param pause
     */
    public pause(pause: boolean): this {
        if (typeof pause !== "boolean")
            throw new RangeError('Pause can only be "true" or "false".');
        if (this.paused === pause || !this.queue.totalSize) return this;
        this.playing = !pause;
        this.paused = pause;
        this.node.send({
            op: "pause",
            guildId: this.guild,
            pause,
        });
        return this;
    }

    /**
     * @param position
     */
    public seek(position: number): this {
        if (!this.queue.current) return undefined as unknown as this;
        position = Number(position);

        if (isNaN(position)) {
            throw new RangeError("Position must be a number.");
        }
        if (position < 0 || position > this.queue.current.duration)
            position = Math.max(Math.min(position, this.queue.current.duration), 0);

        this.position = position;
        this.node.send({
            op: "seek",
            guildId: this.guild,
            position,
        });
        return this;
    }
}

export interface PlayerOptions {
    guild: string;
    textChannel: string;
    voiceChannel?: string;
    node?: string;
    volume?: number;
    selfMute?: boolean;
    selfDeafen?: boolean;
}
export interface Track {
    readonly track: string;
    readonly title: string;
    readonly identifier: string;
    readonly author: string;
    readonly duration: number;
    readonly isSeekable: boolean;
    readonly isStream: boolean;
    readonly uri: string;
    readonly thumbnail: string | null;
    readonly requester: unknown | null;
    displayThumbnail(size?: Sizes): string;
}

export interface UnresolvedTrack extends Partial<Track> {
    title: string;
    author?: string;
    duration?: number;
    resolve(): Promise<void>;
}

export interface PlayOptions {
    readonly startTime?: number;
    readonly endTime?: number;
    readonly noReplace?: boolean;
}

export interface EqualizerBand {
    band: number;
    gain: number;
}