'use strict';

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const axios = require('axios').default;
const https = require('https');

const instance = axios.create({
	httpsAgent: new https.Agent({
		rejectUnauthorized: false,
	}),
});

// Load your modules here, e.g.:
// const fs = require("fs");

const connectionToken = '';

class Smaevcharger extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'smaevcharger',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	async checkConnection() {
		if (!connectionToken) {
			this.log.info(`Hello world`);

			// instance
			// 	.post(
			// 		`https://${this.config.chargerip}/api/v1/token`,
			// 		{
			// 			grant_type: 'password',
			// 			username: 'ETM-GmbH',
			// 			password: 'Sol-9262-1',
			// 		},
			// 		{
			// 			headers: {
			// 				'Content-Type': 'multipart/form-data',
			// 			},
			// 		},
			// 	)
			// 	.then((response) => {
			// 		this.log.info(`Response: ${response}`);
			// 		if (response.status === 200) {
			// 			this.log.info(`Token: ${response.data.access_token}`);
			// 		}
			// 	});

			instance
				.post(
					`https://${this.config.chargerip}/api/v1/token`,
					{
						grant_type: 'password',
						username: this.config.username,
						password: this.config.password,
					},
					{
						headers: {
							accept: 'application/json, text/plain, */*',
							'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
						},
					},
				)
				.then((response) => {
					this.log.info(`Response: ${response}`);
					if (response.status === 200) {
						this.log.info(`Token: ${response.data.access_token}`);
					}
				});

			this.setState('info.connection', true, true);
		}
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// Reset the connection indicator during startup
		this.setState('info.connection', false, true);
		this.log.info(`Connecting to ${this.config.chargerip}`);

		//await this.checkConnection();

		// await this.setObjectNotExistsAsync('info.carConnected', {
		// 	type: 'state',
		// 	common: {
		// 		name: 'info.carConnected',
		// 		type: 'boolean',
		// 		role: 'indicator',
		// 		read: true,
		// 		write: false,
		// 	},
		// 	native: {},
		// });

		// await this.setObjectNotExistsAsync('info.carCharging', {
		// 	type: 'state',
		// 	common: {
		// 		name: 'info.carCharging',
		// 		type: 'boolean',
		// 		role: 'indicator',
		// 		read: true,
		// 		write: false,
		// 	},
		// 	native: {},
		// });

		this.log.info(`Setting car states`);

		this.setState('info.carConnected', false, true);
		this.setState('info.carCharging', false, true);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Smaevcharger(options);
} else {
	// otherwise start the instance directly
	new Smaevcharger();
}
