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
		// this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));

		this.updateRead = null;
		this.updateWrite = null;
		this.connectionToken = '';
	}

	async intervalRead() {
		if (this.updateRead) {
			this.clearTimeout(this.updateRead);
		}

		// do work
		this.log.info(`Simulating read`);

		// make sure we have a token
		await this.getToken();

		this.log.info(`Token: ${this.connectionToken}`);

		instance
			.post(`https://${this.config.chargerip}/api/v1/measurements/live/`, [{ componentId: 'IGULD:SELF' }], {
				headers: {
					accept: 'application/json, text/plain, */*',
					'content-type': 'application/json',
					Authorization: `Bearer ${this.connectionToken}`,
				},
			})
			.then((response) => {
				this.log.debug(`Response code ${response.status}`);
				if (response.status === 200) {
					console.log(response.data);
					this.log.info(`Data: ${response.data}`);
				} else {
					this.log.error(`Error, could not connect, response code ${response.status}`);
				}
			})
			.catch((error) => {
				this.log.error(`Could not connect to charger, error: ${error}`);
			});

		this.updateRead = this.setTimeout(async () => {
			this.updateRead = null;
			await this.intervalRead();
		}, this.config.updateRateRead * 1000);
	}

	async intervalWrite() {
		if (this.updateWrite) {
			this.clearTimeout(this.updateWrite);
		}

		// do work
		this.log.info(`Simulating write`);

		this.updateWrite = this.setTimeout(async () => {
			this.updateWrite = null;
			await this.intervalWrite();
		}, this.config.updateRateWrite * 1000);
	}

	async getToken() {
		// if we do not have a connectionToken, we have to get one
		if (!this.connectionToken) {
			await instance
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
					this.log.debug(`Response code ${response.status}`);
					if (response.status === 200) {
						this.setState('info.connection', true, true);
						this.connectionToken = response.data.access_token;
						this.log.debug(`Token received`);
					} else {
						this.setState('info.connection', false, true);
						this.log.error(`Error, could not connect, response code ${response.status}`);
					}
				})
				.catch((error) => {
					this.log.error(`Could not connect to charger, error: ${error}`);
				});
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

		// get first token
		// await this.getToken();

		// initialize variables
		await this.setObjectNotExistsAsync('charger.carConnected', {
			type: 'state',
			common: {
				name: 'Car is connected',
				type: 'boolean',
				role: 'indicator',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('charger.carCharging', {
			type: 'state',
			common: {
				name: 'Car is charging',
				type: 'boolean',
				role: 'indicator',
				read: true,
				write: false,
			},
			native: {},
		});

		//this.setState('charger.carConnected', false, true);
		//this.setState('charger.carCharging', false, true);
		this.intervalRead();
		this.intervalWrite();
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			if (this.updateRead) {
				this.clearTimeout(this.updateRead);
			}
			if (this.updateWrite) {
				this.clearTimeout(this.updateWrite);
			}

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
	// onStateChange(id, state) {
	// 	if (state) {
	// 		// The state was changed
	// 		this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
	// 	} else {
	// 		// The state was deleted
	// 		this.log.info(`state ${id} deleted`);
	// 	}
	// }

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
