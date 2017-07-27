// literally the only reason why this has to be an npm package
export function generateNativeModuleString(projectName: string): string {
    const fixedProjectName = projectName.replace(/-/g, "_");

    const nativeString = `
var _${fixedProjectName}$Native_Jsonify = {
    stringify: function(thing) { return JSON.stringify(thing); }
};`;

    return nativeString;
}

function importLine(fullFunctionName: string): string {
    return "import " + fullFunctionName.substr(0, fullFunctionName.lastIndexOf("."));
}

function functionName(functionLine: string): string {
    return functionLine.substr(functionLine.lastIndexOf("."));
}

// this is our render's file contents
// basically just boilerplate
export function generateRendererFile(viewFunction: string, decoderName: string): string {
    const imports = importLine(viewFunction) + "\n" + importLine(decoderName);

    const rendererFileContents = `
port module PrivateMain exposing (..)

import Platform
import Html exposing (Html)
import ElmHtml.InternalTypes exposing (decodeElmHtml)
import ElmHtml.ToString exposing (nodeToStringWithOptions, defaultFormatOptions)
import Json.Decode as Json
import Native.Jsonify

${imports}


asJsonString : Html msg -> String
asJsonString = Native.Jsonify.stringify

options = { defaultFormatOptions | newLines = True, indent = 4 }

decode : Html msg -> String
decode view =
    case Json.decodeString decodeElmHtml (asJsonString view) of
        Err str -> "ERROR:" ++ str
        Ok str -> nodeToStringWithOptions options str

init : Json.Value -> ((), Cmd msg)
init values =
    case Json.decodeValue ${decoderName} values of
        Err err -> ((), htmlOut ("ERROR:" ++ err))
        Ok model ->
            ((), htmlOut <| decode <| ${viewFunction} model)


main = Platform.programWithFlags
    { init = init
    , update = (\\_ b -> (b, Cmd.none))
    , subscriptions = (\\_ -> Sub.none)
    }

port htmlOut : String -> Cmd msg
`;
    return rendererFileContents;
}
