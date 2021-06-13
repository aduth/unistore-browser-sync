/**
 * A message object passed between ports.
 *
 * @typedef {object} Message
 *
 * @property {string} type Message type.
 */

/**
 * Message handler.
 *
 * @typedef {(message:Message)=>void} MessageHandler
 */

/**
 * A dispatch message passed between ports.
 *
 * @typedef {object} DispatchMessageChildType
 *
 * @property {string}   action Action name.
 * @property {Array<*>} args   Action arguments.
 *
 * @typedef {Message & DispatchMessageChildType} DispatchMessage
 */

/**
 * A message passed from primary to replica stores on state change.
 *
 * @typedef {object} SetStateMessageChildType
 *
 * @property {object}  state        New state.
 * @property {boolean} isInitialize Whether initializing state change.
 *
 * @typedef {Message & SetStateMessageChildType} SetStateMessage
 */

/**
 * A function responsible for handling a dispatch message.
 *
 * @typedef {(details:DispatchMessage)=>void} Dispatcher
 */

/**
 * The dispatch function signature.
 *
 * @typedef {(action:string,...args:any)=>void} Dispatch
 */

/**
 * Enhanced Unistore store, including dispatch function.
 *
 * @see https://github.com/developit/unistore#api
 *
 * @typedef SyncStoreType
 *
 * @property {Dispatch} dispatch Dispatch an action, applying the object result
 *                               as a patch on the current store state.
 *
 * @typedef {import('unistore').Store & SyncStoreType} SyncStore
 */

/**
 * Port name used to identify connected ports as replica stores.
 *
 * @type {string}
 */
const PORT_NAME = 'sync';

/**
 * Enhances a store to dispatch actions using a specified dispatch handler.
 *
 * @param {import('unistore').Store} store      Store to enhance.
 * @param {Dispatcher}               dispatcher Dispatch handler.
 *
 * @return {SyncStore} Enhanced store.
 */
function withDispatch(store, dispatcher) {
	return {
		...store,
		dispatch(action, ...args) {
			dispatcher({
				type: 'dispatch',
				action,
				args,
			});
		},
	};
}

/**
 * Returns a message handler which invokes given handler only if matching type.
 *
 * @param {string}         type    Type on which to filter messages.
 * @param {MessageHandler} handler Message handler.
 *
 * @return {MessageHandler} Filtering message handler.
 */
function ifMessageType(type, handler) {
	/**
	 * Fitering message handler.
	 *
	 * @param {Message} message Message from port to compare against.
	 */
	return (message) => void (message.type === type && handler(message));
}

/**
 * Enhances the given store to sync changes to all connected replica stores. An
 * optional object of actions keyed by action name enables state mutation from
 * replica stores or the primary store itself. An object returned by a
 * dispatched action applies as a patch on the current store state.
 *
 * @param {import('unistore').Store}     store   Store to enhance.
 * @param {import('unistore').ActionMap} actions Action map.
 *
 * @return {SyncStore} Primary store.
 */
export function primary(store, actions = {}) {
	/**
	 * Handles a dispatch message, either from a replica content port, or from
	 * the same frame where a dispatch occurs.
	 *
	 * @param {DispatchMessage} message
	 */
	function dispatch(message) {
		const { action, args } = message;
		if (actions.hasOwnProperty(action)) {
			store.action(actions[action])(...args);
		}
	}

	const handleMessage = ifMessageType('dispatch', dispatch);

	/**
	 * Sends setState message to a port, optionally as an initialization.
	 *
	 * @param {browser.runtime.Port} port                 Port to message.
	 * @param {boolean=}             [isInitialize=false] Whether initializes.
	 */
	function postSetState(port, isInitialize = false) {
		port.postMessage({
			type: 'setState',
			state: store.getState(),
			isInitialize,
		});
	}

	/** @type {browser.runtime.Port[]} */
	const ports = [];

	// Sync state to ports on change.
	store.subscribe(() => ports.forEach((port) => postSetState(port)));

	browser.runtime.onConnect.addListener((port) => {
		if (port.name !== PORT_NAME) {
			return;
		}

		// Initialize the port.
		postSetState(port, true);

		// Track port for subscribe updates.
		ports.push(port);

		// Start listening for dispatches.
		port.onMessage.addListener(handleMessage);

		port.onDisconnect.addListener(() => {
			// Unbind message handler when content port disconnects.
			port.onMessage.removeListener(handleMessage);

			// Remove port from subscribers.
			ports.splice(ports.indexOf(port), 1);
		});
	});

	return withDispatch(store, handleMessage);
}

/**
 * Given a store to enhance as a replica of the primary store, returns a promise
 * resolving to the enhanced store. The promise resolves once its initial state
 * has been set from the primary store.
 *
 * @param {import('unistore').Store} store Store to enhance.
 *
 * @return {Promise<SyncStore>} Promise resolving to replica store.
 */
export function replica(store) {
	return new Promise((resolve) => {
		const port = browser.runtime.connect({ name: PORT_NAME });

		/** @type {Dispatcher} */
		const dispatcher = (message) => port.postMessage(message);

		/** @type {SyncStore} */
		const replicaStore = withDispatch(store, dispatcher);

		/**
		 * Handles a setState message from the primary store.
		 *
		 * @param {SetStateMessage} message
		 */
		function setState(message) {
			const { state, isInitialize } = message;

			replicaStore.setState(state, true);

			if (isInitialize) {
				resolve(replicaStore);
			}
		}

		const handleMessage = ifMessageType('setState', setState);

		port.onMessage.addListener(handleMessage);
	});
}

if (typeof window !== 'undefined') {
	/** @type {any} */ (window).unistoreBrowserSync = {
		primary,
		replica,
	};
}
