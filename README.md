# elm-static-html-lib

Generate static html by passing an optional json object to your Elm views.

Library version of elm-static-html.

## Install

```
npm install --save elm-static-html-lib
```

## Usage

### with an argument

In this example, we use `decodeModel` to turn the passed JSON into a model that our view can use.

```javascript

import elmStaticHtml from "elm-static-html-lib";


const model = { name: "Noah", age : 24 };
const options = { model : model, decoder: "MyModule.decodeModel" };

elmStaticHtml("/absolute/path/to/elm-package.json", "MyModule.view", options)
.then((generatedHtml) => {
    fs.writeFileSync("output.html", generatedHtml);
});

```

### without an argument

In this case, our view has the type `Html msg`.

```javascript

import elmStaticHtml from "elm-static-html-lib";


const options = { };

elmStaticHtml("/absolute/path/to/elm-package.json", "MyModule.view", options)
.then((generatedHtml) => {
    fs.writeFileSync("output.html", generatedHtml);
});

```

### With no indent

In order to truly match what Elm generates at runtime, you may not want to have spaces or indent inserted. You can do this by setting the `newLines` and `indent` options like so:

```javascript

import elmStaticHtml from "elm-static-html-lib";


const model = { name: "Noah", age : 24 };
const options = { model : model, decoder: "MyModule.decodeModel", newLines: false, indent: 0 };

elmStaticHtml("/absolute/path/to/elm-package.json", "MyModule.view", options)
.then((generatedHtml) => {
    fs.writeFileSync("output.html", generatedHtml);
});

```

### API description

```js
elmStaticHtml(packagePath, viewFunction, options)
```

- **packagePath** *(String)*: an absolute path to the `elm-package.json` of your project.
- **viewFunction** *(String)*: [Qualified name](https://guide.elm-lang.org/reuse/modules.html) to the view function. Format `<ModuleName>.<functionName>`
- **options** *(object)*: A map of options. Can be either empty or contain a model and a qualified decoder name. See above for usage details.


### More examples


Check out the [example](https://github.com/eeue56/elm-static-html-lib/tree/master/example) folder for a more in-depth example.


## Production

If you are running this in production, you may want to only generate the boilerplate files once. You can do that by setting the option `alreadyRun` to true. When `alreadyRun` is true, the Elm app is only started -- no boilerplate is generated.

You may want to hide warnings, which you can do by setting `HIDE_WARNINGS=true` in your env.