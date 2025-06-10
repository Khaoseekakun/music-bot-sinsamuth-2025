import { client } from "..";

client.manager.on("nodeConnect", (node) => {
    console.log(`Node ${node.host} connected`)
})