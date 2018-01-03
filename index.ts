import { spawn } from "child_process";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as templates from "./templates";

/* tslint:disable-next-line */
const compile = require("node-elm-compiler").compile;

const renderDirName = ".elm-static-html";

export interface Options {
    model?: any;
    decoder?: string;
    alreadyRun?: boolean;
    elmMakePath?: string;
    installMethod?: string;
    indent?: number;
    newLines?: boolean;
}

function makeCacheDir(dirPath: string) {
    // make our cache dir
    try {
        fs.mkdirSync(dirPath);
        fs.mkdirSync(path.join(dirPath, "Native"));
    } catch (e) {
        // ignore this and try to continue anyway
    }
}

function parseProjectName(repoName: string): string {
    return repoName
        .replace("https://github.com/", "")
        .replace(".git", "")
        .replace("/", "$");
}

function runElmApp(moduleHash: string, viewHash: string, dirPath: string, model: any): Promise<string> {

    return new Promise((resolve, reject) => {
        const Elm = require(path.join(dirPath, "elm.js"));
        const privateName = `PrivateMain${moduleHash}`;

        if (Object.keys(Elm).indexOf(privateName) === - 1) {
            return reject("Code generation problem: Unable to find the module: " + privateName);
        }

        let elmApp;

        if (typeof model === "undefined") {
            elmApp = Elm[privateName].worker();
        } else {
            elmApp = Elm[privateName].worker(model);
        }

        elmApp.ports[`htmlOut${viewHash}`].subscribe(resolve);
    });
}

function wipeElmFromCache(dirPath: string) {
    try {
        const resolved = require.resolve(path.join(dirPath, "elm.js"));
        delete require.cache[resolved];
    } catch (e) {
        // ignore if we didn't have elm in the require cache
    }
}

function installPackages(dirPath: string, installMethod?: string) {
    return new Promise((resolve, reject) => {
        if (installMethod) {
            const runningProcess = spawn(installMethod, [], { cwd: dirPath });
            runningProcess.on("close", resolve);
        } else {
            resolve();
        }
    });
}

function makeHash(viewFunction: string): string {
    return createHash("MD5").update(viewFunction).digest("hex");
}

export interface ViewFunctionConfig {
    viewFunction: string;
    model?: any;
    decoder?: string;
    indent?: number;
    newLines?: boolean;
}

// compiles multiple view functions into one elm file
// which is much faster if you're likely to need all of them
export function grouped(
    rootDir: string, moduleName: string, configs: ViewFunctionConfig[],
    alreadyRun?: boolean, elmMakePath?: string, installMethod?: string): Promise<string[]> {
    const moduleHash = makeHash(moduleName);

    const dirPath = path.join(rootDir, renderDirName);

    if (alreadyRun === true) {
        const runs = configs.map((config) => runElmAppConfig(moduleHash, config, dirPath));
        return Promise.all(runs);
    }

    // try to load elm-package.json
    const originalElmPackagePath = path.join(rootDir, "elm-package.json");
    let elmPackage: any = null;
    try {
        elmPackage = JSON.parse(fs.readFileSync(originalElmPackagePath, "utf8"));
    } catch (e) {
        return Promise.reject(`Failed to load ${originalElmPackagePath}`);
    }

    makeCacheDir(dirPath);
    wipeElmFromCache(dirPath);

    const projectName = parseProjectName(elmPackage.repository);
    elmPackage = fixElmPackage(rootDir, elmPackage);

    const elmPackagePath = path.join(dirPath, "elm-package.json");
    const privateMainPath = path.join(dirPath, `PrivateMain${moduleHash}.elm`);
    const nativePath = path.join(dirPath, "Native/Jsonify.js");

    fs.writeFileSync(elmPackagePath, JSON.stringify(elmPackage));

    const templateConfigs = configs.map((config) => { return {
           decoder: config.decoder,
           indent: config.indent,
           model: config.model,
           newLines: config.newLines,
           viewFunction: config.viewFunction,
        viewHash: makeHash(config.viewFunction)};
    },
    );

    const rendererFileContents = templates.generateRendererFileMany(moduleHash, templateConfigs);
    fs.writeFileSync(privateMainPath, rendererFileContents);

    const nativeString = templates.generateNativeModuleString(projectName);
    fs.writeFileSync(nativePath, nativeString);

    return installPackages(dirPath, installMethod).then(() => {
        return runCompilerMany(moduleHash, privateMainPath, dirPath, configs, elmMakePath);
    });
}

export default function elmStaticHtml(rootDir: string, viewFunction: string, options: Options): Promise<string> {
    const viewHash = makeHash(viewFunction);

    const dirPath = path.join(rootDir, renderDirName);

    if (options.alreadyRun === true) {
        return runElmApp(viewHash, viewHash, dirPath, options.model);
    }

    // try to load elm-package.json
    const originalElmPackagePath = path.join(rootDir, "elm-package.json");
    let elmPackage: any = null;
    try {
        elmPackage = JSON.parse(fs.readFileSync(originalElmPackagePath, "utf8"));
    } catch (e) {
        return Promise.reject(`Failed to load ${originalElmPackagePath}`);
    }

    makeCacheDir(dirPath);
    wipeElmFromCache(dirPath);

    const projectName = parseProjectName(elmPackage.repository);
    elmPackage = fixElmPackage(rootDir, elmPackage);

    const elmPackagePath = path.join(dirPath, "elm-package.json");
    const privateMainPath = path.join(dirPath, `PrivateMain${viewHash}.elm`);
    const nativePath = path.join(dirPath, "Native/Jsonify.js");

    fs.writeFileSync(elmPackagePath, JSON.stringify(elmPackage));

    const rendererFileContents = templates.generateRendererFile(
        viewHash, viewFunction, options.decoder, options.newLines, options.indent);
    fs.writeFileSync(privateMainPath, rendererFileContents);

    const nativeString = templates.generateNativeModuleString(projectName);
    fs.writeFileSync(nativePath, nativeString);

    return installPackages(dirPath, options.installMethod).then(() => {
        return runCompiler(viewHash, privateMainPath, dirPath, options.model, options.elmMakePath);
    });
}

function fixElmPackage(workingDir: string, elmPackage: any) {
    elmPackage["native-modules"] = true;
    const sources = elmPackage["source-directories"].map((dir: string) => {
        return path.join(workingDir, dir);
    });
    sources.push(".");

    elmPackage["source-directories"] = sources;
    elmPackage.dependencies["eeue56/elm-html-in-elm"] = "2.0.0 <= v < 3.0.0";

    return elmPackage;
}

function runCompiler(viewHash: string,
                     privateMainPath: string, rootDir: string, model: any, elmMakePath?: string): Promise<string> {
    const options: any = {
        cwd: rootDir,
        output: "elm.js",
        yes: true,
    };

    if (elmMakePath) {
        options.pathToMake = elmMakePath;
    }

    return new Promise((resolve, reject) => {
        fs.readdir(rootDir, (err, files) => {
            const actualFiles = files.filter((name) => name.indexOf("PrivateMain") === 0);

            const compileProcess = compile(actualFiles, options);
            compileProcess.on("exit",
                (exitCode: number) => {
                    if (exitCode !== 0) {
                        return reject(exitCode);
                    }

                    return runElmApp(viewHash, viewHash, rootDir, model).then(resolve);
                },
            );
        });
    });
}

function runElmAppConfig(moduleHash: string, config: ViewFunctionConfig, rootDir: string): Promise<string> {
    return runElmApp(moduleHash, makeHash(config.viewFunction), rootDir, config.model);
}

function runCompilerMany(moduleHash: string,
                         privateMainPath: string,
                         rootDir: string, configs: ViewFunctionConfig[], elmMakePath?: string): Promise<string[]> {
    const options: any = {
        cwd: rootDir,
        output: "elm.js",
        yes: true,
    };

    if (elmMakePath) {
        options.pathToMake = elmMakePath;
    }

    return new Promise((resolve, reject) => {
        fs.readdir(rootDir, (err, files) => {
            const actualFiles = files.filter((name) => name.indexOf("PrivateMain") === 0);

            const compileProcess = compile(actualFiles, options);
            compileProcess.on("exit",
                (exitCode: number) => {
                    if (exitCode !== 0) {
                        return reject(exitCode);
                    }

                    const runs = configs.map((config) => runElmAppConfig(moduleHash, config, rootDir));

                    // return runElmApp(moduleHash, rootDir, model).then(resolve);
                    return Promise.all(runs).then(resolve);
                },
            );
        });
    });
}
