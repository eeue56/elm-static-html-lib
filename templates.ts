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

function init(configs: ViewFunctionConfig[]): string {
    const renderNames = configs.map((config) => "render" + config.viewHash);
    return `
init : Json.Value -> ((), Cmd msg)
init values =
    let command =
            [ ${ renderNames } ]
                |> List.map (\\renderer -> renderer values)
                |> Cmd.batch
    in
        ((), command)
`;

}

function initBodyWithDecoder(viewHash: string, viewFunction: string, decoderName: string): string {
    return `
init : Json.Value -> ((), Cmd msg)
init values =
    case Json.decodeValue ${decoderName} values of
        Err err -> ((), htmlOut${viewHash} ("ERROR:" ++ err))
        Ok model ->
            ((), render${viewHash} model)
`;
}
    /*
    return `
init : Json.Value -> ((), Cmd msg)
init values =
    case Json.decodeValue ${decoderName} values of
        Err err -> ((), htmlOut${viewHash} ("ERROR:" ++ err))
        Ok model ->
            ((), htmlOut${viewHash} <| decode <| ${viewFunction} model)
`;
}
     */

function initBodyWithoutDecoder(viewHash: string, viewFunction: string): string {
    return `
init : Json.Value -> ((), Cmd msg)
init _ =
    ((), render${viewHash})
`;
}
    /*
    return `
init : Json.Value -> ((), Cmd msg)
init _ =
    ((), htmlOut${viewHash} <| decode <| ${viewFunction})
`;
}
     */

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
render${viewHash} : Json.Value -> Cmd msg
render${viewHash} values =
    let
        ${optionsSet}

        decode : Html msg -> String
        decode view =
            case Json.decodeValue decodeElmHtml (asJsonView view) of
                Err str -> "ERROR:" ++ str
                Ok str -> nodeToStringWithOptions options str
    in
        case Json.decodeValue ${decoderName} values of
            Err err ->
                htmlOut${viewHash} ("I could not decode the argument for ${viewFunction}:" ++ err)

            Ok model ->
                htmlOut${viewHash} <| decode <| ${viewFunction} model
        `;
        }

function renderCommandWithoutDecoder(viewHash: string, viewFunction: string, optionsSet: string) {
    return `
render${viewHash} : Json.Value -> Cmd msg
render${viewHash} _ =
    let
        ${optionsSet}

        decode : Html msg -> String
        decode view =
            case Json.decodeValue decodeElmHtml (asJsonView view) of
                Err str -> "ERROR:" ++ str
                Ok str -> nodeToStringWithOptions options str
    in
        htmlOut${viewHash} <| decode <| ${viewFunction}
        `;
}

function generateBody(config: ViewFunctionConfig): string {
    const optionsSet = generateOptionsSet(config.newLines, config.indent);
    if (config.decoder) {
        return renderCommandWithDecoder(config.viewHash, config.viewFunction, config.decoder, optionsSet);
    } else {
        return renderCommandWithoutDecoder(config.viewHash, config.viewFunction, optionsSet);
    }
}

function removeDuplicates(arrArg: any[]): any[] {
  return arrArg.filter((elem, pos, arr) => {
    return arr.indexOf(elem) === pos;
  });
}

// this is our render's file contents
// basically just boilerplate
export function generateRendererFileMany(hash: string, configs: ViewFunctionConfig[]): string {
    const viewImports =
        configs
            .map((config) => importLine(config.viewFunction))
            .join("\n");

    const decoderImports =
        configs
            .map((config) => (config.decoder) ? importLine(config.decoder) + "\n" : "")
            .join("");

    const imports = viewImports + "\n" + decoderImports;

    const initBody = init(configs);

    const renderCommands =
        configs
            .map(generateBody)
            .join("\n\n");

    // duplicate ports are now allowed, so remove duplicates
    const uniqueViewHashes = removeDuplicates(configs.map((config) => config.viewHash));

    const ports =
        uniqueViewHashes
            .map((viewHash) => `port htmlOut${viewHash} : String -> Cmd msg`)
            .join("\n");

    const rendererFileContents = `
port module PrivateMain${hash} exposing (..)

import Platform
import Html exposing (Html)
import ElmHtml.InternalTypes exposing (decodeElmHtml)
import ElmHtml.ToString exposing (nodeToStringWithOptions, defaultFormatOptions)
import Json.Decode as Json
import Native.Jsonify

${imports}


asJsonView : Html msg -> Json.Value
asJsonView = Native.Jsonify.stringify

${renderCommands}

${initBody}

main = Platform.programWithFlags
    { init = init
    , update = (\\_ b -> (b, Cmd.none))
    , subscriptions = (\\_ -> Sub.none)
    }

${ports}
`;
    return rendererFileContents;
}

export function generateRendererFile(
    viewHash: string, viewFunction: string, decoderName: string, newLines: boolean, indent: number): string {
    const config = { viewFunction, viewHash, decoder: decoderName, newLines, indent };
    return generateRendererFileMany(viewHash, [config]);
}
