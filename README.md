# elm-jsphoenix
Elm Port wrapper around Phoenix Socket/Presence javascript library to allow compatibility with existing javascript websocket usage

## Installation
Include the JSPhoenix.elm module however you wish.

Add the javascript file to your Phoenix brunch (or whatever you've replaced it with) build system to include in your Phoenix project.

In the javascript for your Phoenix project any Elm app that you instance just call the `setup_phoenix_socket_ports` from the setup_phoenix_socket_ports javascript module, such as by:
```javascript
import socket from './socket'
import Elm from './elm' // Assuming your Elm mains compile to a ./elm.js in the same directory as your app.js
import setup_phoenix_socket_ports from 'setup_phoenix_socket_ports' // Or from where-ever


let socket_setup_once = false
socket.onOpen(() => {
  $(document).ready(function(){
    if(socket_setup_once) return
    socket_setup_once = true

    // Here setup all your usual javascript that also needs to use the websocket

    let app = Elm.Main.embed(document.querySelector('#my-elm-container'))
    setup_phoenix_socket_ports(app, socket)
  }
}
```

Even if you do not have any other javascript code using the socket this still ensures full compatibility of your Elm app with the Phoenix socket interface, heartbeats, recovery, and all.


## Usage
The bindings are not absolutely complete to the javascript code, but rather a useful interface is exposed to Elm within its type system.

This is a brand new project and the documentation is not entirely complete, however the code is short and should be readable.

### General usage is as follows

Connect to a channel, specify presence sync ports and some message ports and how to use:
```elm
import JSPhoenix exposing (ChannelEventMsg, ChanExitCB)

-- Currently this next line does not work due to Elm bugs...
--type alias RoomSyncState = List (JSPhoenix.PresenceObject {} {online_at : JSPhoenix.TimexDateTime, nick : String})
-- So instead you have to do this mess for each of your presence sync object types because of Elm port bugs:
type alias RoomSyncMeta =
  { phx_ref : String -- Until Elm bug is fixed, phx_ref should 'generally' always be here
  , loc : String
  , online_at : JSPhoenix.TimexDateTime
  , nick : String
  }

type alias RoomSyncState =
  List ( String, { metas : List RoomSyncMeta } ) -- Until Elm bug is fixed 'metas' must *always* be here with a List of records


-- Same bug issue as above, you should be able to do:
--type alias RoomSyncEvent = JSPhoenix.PresenceObject {} {online_at : JSPhoenix.TimexDateTime, nick : String}
-- Instead you have to do this mess for each presence sync event type
type alias RoomSyncEvent =
  { id : String
  , old : Maybe { String, List RoomSyncMeta }
  , new : List ( String, List RoomSyncMeta )
  }

-- Custom messages, whatever fits your Phoenix app:
type alias RoomMessage =
  { room_id : Int
  , uid : Int
  , inserted_at : JSPhoenix.TimexDateTime
  , updated_at : JSPhoenix.TimexDateTime
  , nick : String
  , msg : String
  }

type alias RoomMessages =
  { msgs : List RoomMessage }

port onRoomConnect : (ChannelEventMsg {} Int -> msg) -> Sub msg
port onRoomInfo : (ChannelEventMsg {} Int -> msg) -> Sub msg
port onRoomMsgsInit : (ChannelEventMsg RoomMessages Int -> msg) -> Sub msg
port onRoomMsgsAdd : (ChannelEventMsg RoomMessages Int -> msg) -> Sub msg
port onRoomSyncState : (ChannelEventMsg RoomSyncState Int -> msg) -> Sub msg
port onRoomSyncJoin : (ChannelEventMsg RoomSyncEvent Int -> msg) -> Sub msg
port onRoomSyncLeave : (ChannelEventMsg RoomSyncEvent Int -> msg) -> Sub msg

connect_room rid =
  JSPhoenix.connect
      { topic = room_id_to_topic rid
      , timeout_ms = Nothing -- Just 10000 -- Default value is 10000 if Nothing is used
      , chanCloseCB = Nothing
      , chanErrorCB = Nothing
      , syncState = Just { portName = "onRoomSyncState", cb_data = (int rid) }
      , syncJoin = Just { portName = "onRoomSyncJoin", cb_data = (int rid) }
      , syncLeave = Just { portName = "onRoomSyncLeave", cb_data = (int rid) }
      , joinData = null
      , joinEvents =
          [ { portName = "onRoomConnect", msgID = "ok", cb_data = (int rid) }
          ]
      , onPorts =
          [ { portName = "onRoomInfo", msgID = "room:info", cb_data = (int rid) }
          , { portName = "onRoomMsgsInit", msgID = "msgs:init", cb_data = (int rid) }
          , { portName = "onRoomMsgsAdd", msgID = "msgs:add", cb_data = (int rid) }
          ]
      }

update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
  case msg of
    -- ... other messages

    MyConnectMessage rid ->
      ( model
      , connect_room rid -- You can use the JSPhoenix.connect like any normal command
      )

subscriptions : Model -> Sub Msg
subscriptions model =
  Sub.batch -- Subscribe to your port events to get their messages
    [ onRoomConnect (\{ msg, cb_data } -> MyRoomConnectMsg msg cb_data) -- Example to show you the structure of the data
    , onRoomInfo MyRoomInfoMsg
    , onRoomMsgsInit MyRoomMsgsInitMsg
    , onRoomMsgsAdd MyRoomMsgsAddMsg
    , onRoomSyncState MyRoomSyncStateMsg
    , onRoomSyncJoin MyRoomSyncJoinMsg
    , onRoomSyncLeave MyRoomSyncLeaveMsg
    ]
```
