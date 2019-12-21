# Unistore Browser Sync

Extend a [Unistore](https://github.com/developit/unistore) store to replicate state for your browser extension using [`browser.runtime.Port`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/Port), enabling you to share and manipulate state between an extension's background, popup, and options scripts.

## Example

```js
// background.js
import createStore from 'https://unpkg.com/browse/unistore@3.5.1/dist/unistore.es.js';
import { primary } from 'https://unpkg.com/unistore-browser-sync';

const initialState = { count: 1 };
const actions = {
	increment( state ) {
		return { count: state.count + 1 };
	},
};
const store = primary( createStore( initialState ), actions );
```

```js
// popup.js
import createStore from 'https://unpkg.com/browse/unistore@3.5.1/dist/unistore.es.js';
import { replica } from 'https://unpkg.com/unistore-browser-sync';

replica( createStore() ).then( ( store ) => {
	const logCount = () => console.log( 'The current count is %d.', store.getState().count );
	logCount();
	// Logs: "The current count is 1."
	store.subscribe( logCount );

	store.dispatch( 'increment' );
	// Logs: "The current count is 2."
} );
```

## Installation

Install using [npm](https://www.npmjs.com/):

```
npm install unistore-browser-sync
```

Or reference directly from [unpkg](https://unpkg.com/):

https://unpkg.com/unistore-browser-sync

## Usage

Unistore Browser Sync uses the [`browser.runtime.Port` interface](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/Port). If you support Chrome, you should include the [WebExtension `browser` API polyfill](https://github.com/mozilla/webextension-polyfill) if you are not already using it:

```html
<script src="/path/to/browser-polyfill.min.js"></script>
```

Unistore Browser Sync is written using ES Modules. You can import directly from the script if you are already using `<script type="module">` for your extension:

```js
import { replica } from 'https://unpkg.com/unistore-browser-sync';
```

Otherwise, include Unistore Browser Sync using a script tag. Note that it must be assigned `type="module"`.

```html
<script type="module" src="https://unpkg.com/unistore-browser-sync"></script>
```

When included as a script tag, the exported members will be added to the `window` global as `window.unistoreBrowserSync`:

```js
const { primary, replica } = window.unistoreBrowserSync;
```

Syncing occurs between one _primary_ store and one or more _replica_ stores. You should initialize your primary store in your extension's background script, passing an instance of a Unistore store, plus an optional object of named action functions. Actions are bound to the store in the same way as [Unistore's `action` function](https://github.com/developit/unistore#action). A new `dispatch` method will be added to primary and replica store objects, enabling you to reference the actions in other scripts.

```js
// background.js
import createStore from 'https://unpkg.com/browse/unistore@3.5.1/dist/unistore.es.js';
import { primary } from 'https://unpkg.com/unistore-browser-sync';

const initialState = { count: 1 };
const actions = {
	increment( state ) {
		return { count: state.count + 1 };
	},
};
const store = primary( createStore( initialState ), actions );
```

In other scripts where you wish to consume from the primary store, you should use the `replica` exported member of the module. This function accepts an instance of a store on which the primary store state will be set continuously. The return value is a promise which resolves once a connection has been established to the primary store. The resolved value of the promise is a reference to the enhanced store object. A replica store should be treated as read-only with the exception of the `dispatch` action. All state mutations should occur via the actions defined in the primary store, called using the replica store's `dispatch` function.

```js
// popup.js
import createStore from 'https://unpkg.com/browse/unistore@3.5.1/dist/unistore.es.js';
import { replica } from 'https://unpkg.com/unistore-browser-sync';

replica( createStore() ).then( ( store ) => {
	const logCount = () => console.log( 'The current count is %d.', store.getState().count );
	logCount();
	// Logs: "The current count is 1."
	store.subscribe( logCount );

	store.dispatch( 'increment' );
	// Logs: "The current count is 2."
} );
```

## API

### `primary`

Enhances the given store to sync changes to all connected replica stores. An optional object of actions keyed by action name enables state mutation from replica stores or the primary store itself. An object returned by a dispatched action applies as a patch on the current store state.

**Parameters:**

- `store` (`Store`) Store to enhance.
- `actions` (`Object`) Action map.

**Returns:** (`SyncStore`) Primary store

### `replica`

Given a store to enhance as a replica of the primary store, returns a promise resolving to the enhanced store. The promise resolves once its initial state has been set from the primary store.

**Parameters:**

- `store` (`Store`) Store to enhance.

**Returns:** (`Promise<SyncStore>`) Promise resolving to replica store.

## Types

### `SyncStore`

Enhanced Unistore store, including dispatch function.

See: [https://github.com/developit/unistore#api](https://github.com/developit/unistore#api)

### `store.dispatch`

Dispatch an action, applying the object result as a patch on the current store state.

**Parameters:**

- `action` (`string`) Action name.
- `...args` (`...any`) Action arguments.

## Browser Support

Unistore Browser Sync is written and distributed using modern JavaScript, including [ES Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules). Browser support for these features is quite good, and you should expect no issues in browsers which have been updated at least once since 2017. Specifically, this includes Chrome versions 61 and newer (September 2017) and Firefox 60 and newer (May 2018), and Edge 16 and newer (October 2017). If you need to support older versions of these browsers, you can consider to transpile the module as part of your application's build process.

The sync implementation relies on the `browser.runtime` interface. Consult the [MDN browser compatibility chart](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime#Browser_compatibility) for detailed information about browser support. Specifically, Unistore Browser Sync uses [`runtime.onConnect`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onConnect), [`runtime.connect`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/connect), and [`runtime.Port`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/Port). You should not expect to have any issues when targeting reasonably up-to-date browsers.

## License

Copyright 2019 Andrew Duthie

Released under the [MIT License](https://opensource.org/licenses/MIT).
