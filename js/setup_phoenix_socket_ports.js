
import {Presence} from "phoenix"

const ps_debug = false

const add_event_handler_to_channel = (app, channel, msgID, portName, cb_data) => {
  if(ps_debug) console.log("JSPhoenix:JS:add_event_handler_to_channel", channel, msgID, portName)
  channel.on(msgID, msg => {
    app.ports[portName].send({
      topic: channel.topic,
      msgID: msgID,
      msg: msg,
      cb_data: cb_data
    })
  })
}


const set_on_receive = (app, channel, joined, portName, msgID, cb_data) => {
  if(ps_debug) console.log("JSPhoenix:JS:set_on_receive", joined, msgID, portName)
  joined.receive(msgID, msg => {
    app.ports[portName].send({
      topic: channel.topic,
      msgID: msgID,
      msg: msg,
      cb_data: cb_data
    })
  })
}


const convert_presence_objects_dict_to_elm = (objects) => {
  let arr = [];

  for (var key in objects) {
    if (objects.hasOwnProperty(key)) {
      arr.push([key, objects[key]]);
    }
  }

  return arr
}


const setup_phoenix_socket_ports = (app, socket) => {

  let channels = {}
  let presences = {}

  if(app.ports.jsphoenix_connect != undefined) {
    app.ports.jsphoenix_connect.subscribe(
      ({topic, timeout_ms, chanCloseCB, chanErrorCB, syncState, syncJoin, syncLeave, joinData, joinEvents, onPorts}) => {
        if(ps_debug) console.log("JSPhoenix:JS:connect", topic, timeout_ms, chanCloseCB, chanErrorCB, syncState, syncJoin, syncLeave, joinData, joinEvents, onPorts)

        let channel = channels[topic]
        if(channel !== undefined) {
          console.log("Attempted joining a topic multiple times", topic)
          return
        }


        if(ps_debug) console.log("JSPhoenix:JS:Joining", topic, joinData || {})
        channel = socket.channel(topic, joinData || {})
        channels[topic] = channel


        const onSyncJoin = (id, current, newPres) => {
          if(ps_debug) console.log("JSPhoenix:JS:onSyncJoin", id, current, newPres, syncState, syncJoin, syncLeave)
          app.ports[syncJoin.portName].send({
            topic: topic,
            msgID: "presence_join",
            msg: {id: id, old: convert_presence_objects_dict_to_elm(current), new: convert_presence_objects_dict_to_elm(newPres)},
            cb_data: syncJoin.cb_data
          })
        }
        const onSyncLeave = (id, current, newPres) => {
          if(ps_debug) console.log("JSPhoenix:JS:onSyncLeave", id, current, newPres, syncState, syncJoin, syncLeave)
          app.ports[syncLeave.portName].send({
            topic: topic,
            msgID: "presence_leave",
            msg: {id: id, old: convert_presence_objects_dict_to_elm(current), new: convert_presence_objects_dict_to_elm(newPres)},
            cb_data: syncLeave.cb_data
          })
        }

        channel.on("presence_state", state => {
          if(ps_debug) console.log("JSPhoenix:JS:presence_state", state, syncState, syncJoin, syncLeave, presences[topic])
          if(presences[topic] === undefined) presences[topic] = {}
          presences[topic] = Presence.syncState(presences[topic], state, onSyncJoin, onSyncLeave)
          if(syncState) app.ports[syncState.portName].send({
            topic: topic,
            msgID: "presence_state",
            msg: convert_presence_objects_dict_to_elm(presences[topic]),
            cb_data: syncState.cb_data
          })
        })

        channel.on("presence_diff", state => {
          if(ps_debug) console.log("JSPhoenix:JS:presence_diff", state, syncState, syncJoin, syncLeave, presences[topic])
          if(presences[topic] === undefined) presences[topic] = {}
          presences[topic] = Presence.syncDiff(presences[topic], state, onSyncJoin, onSyncLeave)
          if(syncState) app.ports[syncState.portName].send({
            topic: topic,
            msgID: "presence_diff",
            msg: convert_presence_objects_dict_to_elm(presences[topic]),
            cb_data: syncState.cb_data
          })
        })


        onPorts.map(({msgID, portName, cb_data}) => {
          add_event_handler_to_channel(app, channel, msgID, portName, cb_data)
        })


        const cleanup = (msg) => {
          channels[channel.topic] = undefined
        }
        channel.onClose(cleanup)

        if(chanCloseCB) channel.onClose(msg => {
          app.ports[chanCloseCB].send({topic: topic, msg: msg})
        })

        if(chanErrorCB) channel.onError(msg => {
          app.ports[chanErrorCB].send({topic:topic, msg: msg})
        })

        const timeout = timeout_ms || 10000
        let joined = channel.join(timeout)
        if(ps_debug) joined.receive('ok', (msg) => console.log("JSPhoenix:JS:Joined", channel, msg))
        joinEvents.map(({portName, msgID, cb_data}) => {
          set_on_receive(app, channel, joined, portName, msgID, cb_data)
        })

        if(ps_debug) console.log("JSPhoenix:JS:SentJoined", channel)
      })

    app.ports.jsphoenix_disconnect.subscribe(({topic, chanLeavingCB}) => {
      if(ps_debug) console.log("JSPhoenix:JS:disconnect", topic, chanLeavingCB)
      let channel = channels[topic]
      if(channel === undefined) {
        console.log("Attempted disconnect a topic multiple times", topic)
        return
      }
      let leaving = channel.leave()
      if(chanLeavingCB) leaving.receive("ok", (msg) => {
        app.ports[chanLeavingCB].send(topic, msg)
      })
    })

    app.ports.jsphoenix_push.subscribe(({topic, mid, msg, pushEvents}) => {
      if(ps_debug) console.log("JSPhoenix:JS:push", topic, mid, msg)
      let channel = channels[topic]
      if(channel === undefined) {
        console.log("Attempted to push to an unconnected channel", topic, mid)
        return
      }
      let pushed = channel.push(mid, msg)
      pushEvents.map(({portName, msgID, cb_data}) => {
        set_on_receive(app, channel, pushed, portName, msgID, cb_data)
      })
    })
  }

}

export default setup_phoenix_socket_ports
