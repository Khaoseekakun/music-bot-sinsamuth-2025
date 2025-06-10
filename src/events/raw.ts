import { client } from "..";

client.on("raw", d => {
    client.manager.updateVoiceState(d)
})