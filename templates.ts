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

const decode = `
decode : FormatOptions -> Html msg -> String
decode options view =
    case Json.decodeValue decodeElmHtml (asJsonView view) of
        Err str -> "ERROR:" ++ str
        Ok str -> nodeToStringWithOptions options str
            `;

function generateOptionsSet(newLines: boolean, indent: number): string {
    let newLinesStr;
    if (newLines === undefined || newLines === true) {
      newLinesStr = "True";
    } else {
      newLinesStr = "False";
    }

    const indentStr = indent !== undefined ? indent : 4;

    return `options = { defaultFormatOptions | newLines = ${newLinesStr}, indent = ${indentStr} }`;
}

export interface ViewFunctionConfig {
    viewFunction: string;
    viewHash: string;
    model?: any;
    decoder?: string;
    indent?: number;
    newLines?: boolean;
}

function renderCommandWithDecoder(viewHash: string, viewFunction: string, decoderName: string, optionsSet: string) {
    return `
render${viewHash} : Json.Value -> String
render${viewHash} values =
    let
        ${optionsSet}
    in
        case Json.decodeValue ${decoderName} values of
            Err err ->
                "I could not decode the argument for ${viewFunction}:" ++ err

            Ok model ->
                (decode options) <| ${viewFunction} model
        `;
        }

function renderCommandWithoutDecoder(viewHash: string, viewFunction: string, optionsSet: string) {
    return `
render${viewHash} : Json.Value -> String
render${viewHash} _ =
    let
        ${optionsSet}
    in
        (decode options) <| ${viewFunction}
        `;
}

function generateBody(config: ViewFunctionConfig): string {
    const optionsSet = generateOptionsSet(config.newLines, config.indent);
    if (config.decoder) {
        console.log("withDecoder ->", config.decoder, config.viewFunction);
        return renderCommandWithDecoder(config.viewHash, config.viewFunction, config.decoder, optionsSet);
    } else {
        console.log("withoutDecoder ->", config.decoder, config.viewFunction);
        return renderCommandWithoutDecoder(config.viewHash, config.viewFunction, optionsSet);
    }
}

function uniqueBy(toKey: (x: any) => any, array: any[]): any[] {
    const keys = array.map(toKey);

    return array.filter((elem, pos, arr) => {
        return keys.indexOf(toKey(elem)) === pos;
    });
}

export function generateRendererFile(hash: string, configs: ViewFunctionConfig[]): string {
    const viewImports =
        configs
            .map((config) => importLine(config.viewFunction))
            .join("\n");

    const decoderImports =
        configs
            .map((config) => (config.decoder) ? importLine(config.decoder) + "\n" : "")
            .join("");

    const imports = viewImports + "\n" + decoderImports;

    const configsWithUniqueView = uniqueBy((x) => x.viewHash, configs);

    const renderCommands =
        configsWithUniqueView
            .map(generateBody)
            .join("\n\n");

    const renderersList =
        configs
        .map((config) => `render${config.viewHash}`)
            .join(", ");

    const port = `port htmlOut${hash} : List (String, String) -> Cmd msg`;

    return `
port module PrivateMain${hash} exposing (..)

import Platform
import Html exposing (Html)
import ElmHtml.InternalTypes exposing (decodeElmHtml)
import ElmHtml.ToString exposing (FormatOptions, nodeToStringWithOptions, defaultFormatOptions)
import Json.Decode as Json
import Native.Jsonify

${imports}

${decode}

${renderCommands}

renderers : List (Json.Value -> String)
renderers = [ ${renderersList} ]

init : List (String, Json.Value) -> ((), Cmd msg)
init models =
    let command =
            List.map2 (\\renderer (identifier, model) -> (identifier, renderer model)) renderers models
                |> htmlOut${hash}
    in
        ( (), command )


asJsonView : Html msg -> Json.Value
asJsonView = Native.Jsonify.stringify

${port}

main = Platform.programWithFlags
    { init = init
    , update = (\\_ b -> (b, Cmd.none))
    , subscriptions = (\\_ -> Sub.none)
    }
    `;
}
