module MyModule exposing (..)

import Json.Decode
import Html exposing (Html)
import Html.Lazy


type alias Model =
    { age : Int
    , name : String
    }


decodeModel : Json.Decode.Decoder Model
decodeModel =
    Json.Decode.map2 Model
        (Json.Decode.field "age" Json.Decode.int)
        (Json.Decode.field "name" Json.Decode.string)


view : Model -> Html msg
view model =
    Html.div
        []
        [ Html.text <| "I am " ++ model.name
        , Html.text <| "And I am " ++ toString model.age ++ " years old."
        ]


otherView : Html msg
otherView =
    Html.div
        []
        [ Html.div [] [ Html.text "This is a static HTML example without a model" ] ]


lazyView : Model -> Html msg
lazyView model =
    Html.Lazy.lazy view model
