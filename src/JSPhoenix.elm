port module JSPhoenix exposing (..)

import Json.Encode
import Json.Decode
import Date exposing (..)
import Date exposing (Date)
import Date.Extra as Date
import Date.Extra.Facts exposing (monthFromMonthNumber)


-- Phoenix channel message receiver handling


type alias CallbackPortMsg =
    { portName : String
    , msgID : String
    , cb_data : Json.Encode.Value
    }


type alias CallbackPortEvent =
    { portName : String
    , cb_data : Json.Encode.Value
    }


type alias ChanExitCB msg =
    { topic : String
    , msg : msg
    }



-- Connecting


type alias Connect =
    { topic : String
    , timeout_ms : Maybe Int --  Just 10000 -- Default value
    , chanCloseCB : Maybe CallbackPortEvent
    , chanErrorCB : Maybe CallbackPortEvent
    , syncState : Maybe CallbackPortEvent
    , syncJoin : Maybe CallbackPortEvent
    , syncLeave : Maybe CallbackPortEvent
    , joinData : Json.Encode.Value
    , joinEvents : List CallbackPortMsg
    , onPorts : List CallbackPortMsg
    }


port jsphoenix_connect : Connect -> Cmd msg


connect : Connect -> Cmd msg
connect connect_struct =
    jsphoenix_connect connect_struct



-- Disconnecting


type alias Disconnect =
    { topic : String
    , chanLeavingCB : Maybe String
    }


port jsphoenix_disconnect : Disconnect -> Cmd msg


disconnect : Disconnect -> Cmd msg
disconnect disconnect_struct =
    jsphoenix_disconnect disconnect_struct



-- Pushing


type alias Push =
    { topic : String
    , mid : String
    , msg : Json.Encode.Value
    , pushEvents : List CallbackPortMsg
    }


port jsphoenix_push : Push -> Cmd msg


push : Push -> Cmd msg
push push_struct =
    jsphoenix_push push_struct



-- Receiving


type alias ChannelEventMsg msg_type cb_type =
    { topic : String
    , msgID : String
    , msg : msg_type
    , cb_data : cb_type
    }


type alias ChannelGenericEventMsg =
    ChannelEventMsg Json.Decode.Value Json.Decode.Value



-- Phoenix.Presence


type alias PresenceMeta metaUserType =
    { metaUserType
        | phx_ref : String
    }


type alias PresenceMetas metaUserType =
    List (PresenceMeta metaUserType)


type alias PresenceObject msgUserType metaUserType =
    { msgUserType
        | metas : PresenceMetas metaUserType
    }


type alias PresenceObjects msgUserType metaUserType =
    List ( String, PresenceObject msgUserType metaUserType )


type alias PresenceDiff msgUserType metaUserType =
    { leaves : PresenceObject msgUserType metaUserType
    , joins : PresenceObject msgUserType metaUserType
    }


type alias PresenceDiffChange msgUserType metaUserType =
    { id : String
    , old : PresenceObject msgUserType metaUserType
    , new : PresenceObject msgUserType metaUserType
    }



-- Various Integration helpers


type alias TimexDateTime =
    { year : Int
    , timezone :
        { until : String
        , offset_utc : Int
        , offset_std : Int
        , full_name : String
        , from : String
        , abbreviation : String
        }
    , second : Int
    , month : Int
    , minute : Int
    , millisecond : Int
    , hour : Int
    , day : Int
    , calendar : String
    }


emptyTimexDateTime : TimexDateTime
emptyTimexDateTime =
    { year = 0
    , timezone =
        { until = ""
        , offset_utc = 0
        , offset_std = 0
        , full_name = ""
        , from = ""
        , abbreviation = ""
        }
    , second = 0
    , month = 1
    , minute = 0
    , millisecond = 0
    , hour = 0
    , day = 0
    , calendar = ""
    }


convertTimexDateToElmDate : TimexDateTime -> Date
convertTimexDateToElmDate { year, month, day, hour, minute, second, millisecond, timezone } =
    Date.fromSpec
        (Date.offset <| timezone.offset_utc + timezone.offset_std)
        (Date.atTime hour minute second millisecond)
        (Date.calendarDate year (monthFromMonthNumber (month)) day)
