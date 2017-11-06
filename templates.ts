// literally the only reason why this has to be an npm package
export function generateNativeModuleString(projectName: string): string {
    const fixedProjectName = projectName.replace(/-/g, "_");

    const nativeString = `
function forceThunks(vNode) {
    if (typeof vNode !== "undefined" && vNode.ctor === "_Tuple2" && !vNode.node) {
        vNode._1 = forceThunks(vNode._1);
    }
    if (typeof vNode !== 'undefined' && vNode.type === 'thunk' && !vNode.node) {
        vNode.node = vNode.thunk.apply(vNode.thunk, vNode.args);
    }
    if (typeof vNode !== 'undefined' && typeof vNode.children !== 'undefined') {
        vNode.children = vNode.children.map(forceThunks);
    }
    return vNode;
}

var _${fixedProjectName}$Native_Jsonify = {
    stringify: function(thing) { return forceThunks(thing) }
};`;

    return nativeString;
}

function importLine(fullFunctionName: string): string {
    return "import " + fullFunctionName.substr(0, fullFunctionName.lastIndexOf("."));
}

function functionName(functionLine: string): string {
    return functionLine.substr(functionLine.lastIndexOf("."));
}

function initBodyWithDecoder(viewHash: string, viewFunction: string, decoderName: string): string {
    return `
init : Json.Value -> ((), Cmd msg)
init values =
    case Json.decodeValue ${decoderName} values of
        Err err -> ((), htmlOut${viewHash} ("ERROR:" ++ err))
        Ok model ->
            ((), htmlOut${viewHash} <| decode <| ${viewFunction} model)
`;
}

function initBodyWithoutDecoder(viewHash: string, viewFunction: string): string {
    return `
init : Json.Value -> ((), Cmd msg)
init _ =
    ((), htmlOut${viewHash} <| decode <| ${viewFunction})
`;
}

// this is our render's file contents
// basically just boilerplate
export function generateRendererFile(viewHash: string, viewFunction: string, decoderName: string, newLines: boolean, indent: number): string {
    let imports = importLine(viewFunction) + "\n";
    if (decoderName) {
        imports += importLine(decoderName);
    }

    let initBody;
    if (decoderName) {
        initBody = initBodyWithDecoder(viewHash, viewFunction, decoderName);
    } else {
        initBody = initBodyWithoutDecoder(viewHash, viewFunction);
    }
    let newLinesStr = newLines !== undefined ? (newLines.toString().charAt(0).toUpperCase() + newLines.toString().slice(1)) : "True";
    let indentStr = indent !== undefined ? indent : "4";
    let optionsSet = `options { newLines = ${newLinesStr}, indent = ${indentStr}`;

    const rendererFileContents = `
port module PrivateMain${viewHash} exposing (..)

import Platform
import Html exposing (Html)
import ElmHtml.InternalTypes exposing (decodeElmHtml)
import ElmHtml.ToString exposing (nodeToStringWithOptions, defaultFormatOptions)
import Json.Decode as Json
import Native.Jsonify

${imports}


asJsonView : Html msg -> Json.Value
asJsonView = Native.Jsonify.stringify

${optionsSet}

decode : Html msg -> String
decode view =
    case Json.decodeValue decodeElmHtml (asJsonView view) of
        Err str -> "ERROR:" ++ str
        Ok str -> nodeToStringWithOptions options str

${initBody}

main = Platform.programWithFlags
    { init = init
    , update = (\\_ b -> (b, Cmd.none))
    , subscriptions = (\\_ -> Sub.none)
    }

port htmlOut${viewHash} : String -> Cmd msg
`;
    return rendererFileContents;
}
