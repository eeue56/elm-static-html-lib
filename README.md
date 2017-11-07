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

elmStaticHtml("./", "MyModule.view", options)
.then((generatedHtml) => {
    fs.writeFileSync("output.html", generatedHtml);
});

```

### without an argument

In this case, our view has the type `Html msg`.

```javascript

import elmStaticHtml from "elm-static-html-lib";


const options = { };

elmStaticHtml("./", "MyModule.view", options)
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

elmStaticHtml("./", "MyModule.view", options)
.then((generatedHtml) => {
    fs.writeFileSync("output.html", generatedHtml);
});

```


### More examples


Check out the [example](https://github.com/eeue56/elm-static-html-lib/tree/master/example) folder for a more in-depth example.


## Production

If you are running this in production, you may want to only generate the boilerplate files once. You can do that by setting the option `alreadyRun` to true. When `alreadyRun` is true, the Elm app is only started -- no boilerplate is generated.