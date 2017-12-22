var background = {
	config: {},
	board: [],
	boards: {},
	drama: {},
	tabPorts: {},
	ignoratorInfo: {},
	scopeInfo: {},
	imagemapCache: {},
	// currentTab: '',
	noIgnores: true,
	
	init: function(defaultConfig) {
		this.updateConfig(defaultConfig);
		
		if (this.config.history_menubar_classic) {
			this.boards['Misc.'] = {"ChromeLL Options":"%extension%options.html"};
			
			if (this.config.sort_history) {				
				this.boards['Misc.']['Message History'] = 'http://boards.endoftheinter.net/history.php?b';
			} 
			
			else {
				this.boards['Misc.']['Message History'] = 'http://boards.endoftheinter.net/history.php';
			}
		}
		
		if (this.config.saved_tags) {
			this.boards['Tags'] = this.config.saved_tags;
		}
		
		if (this.config.context_menu) {
			this.buildContextMenu();
		}
		
		for (var i in allBg.activeListeners) {
			// sets listeners for force_https, batch_uploader, etc
			allBg.activeListeners[i] = this.config[i];
			if (this.config.debug) {
				console.log('setting listener: ' + i + " " + allBg.activeListeners[i]);
			}
		}
		
		this.init_listener(this.config);
		
		this.messagePassing.addListeners();
		chrome.notifications.onClicked.addListener(this.makeNotificationOriginActive.bind(this));
		this.checkVersion();
		this.omniboxSearch();
		this.createClipboardElement();	
		this.getUserID();
		this.getDrama();
	},
	
	init_listener: function(cfg) {
		// Chrome || Firefox
		var webRequest = chrome.webRequest || browser.webRequest;
		
		if (webRequest == null) return;
		
		// use try...catch statement as options iframe causes problems with webRequest listeners
		try {
			if (cfg.force_https) {
				allBg.activeListeners.force_https = true;
				webRequest.onBeforeRequest.addListener(
						allBg.handle_redirect, {
							"urls" : [ "http://*.endoftheinter.net/*" ]
						}, [ 'blocking' ]);
			}
			if (!cfg.force_https && allBg.activeListeners.force_https) {
				webRequest.onBeforeRequest
						.removeListener(allBg.handle_redirect);
				allBg.activeListeners.force_https = false;
			}

			if (cfg.drop_batch_uploader) {
				webRequest.onBeforeSendHeaders.addListener(
						allBg.handle_batch_uploader, {
							"urls" : [ "http://u.endoftheinter.net/*",
									"https://u.endoftheinter.net/*",
									"https://chairface.org/*" ]
						}, [ 'blocking', 'requestHeaders' ]);
				allBg.activeListeners.batch_uploader = true;
			}

			if (!cfg.batch_uploader && allBg.activeListeners.batch_uploader) {
				webRequest.onBeforeSendHeaders
						.removeListener(allBg.handle_batch_uploader);
				allBg.activeListeners.batch_uploader = false;
			}
		} catch (e) {
			console.log(e);
		}
	},
	
	getDefaultConfig: function(callback) {
		var defaultURL = chrome.extension.getURL('/src/json/defaultconfig.json');
		var xhr = new XMLHttpRequest();
		xhr.open("GET", defaultURL, true);
		xhr.onload = function() {
			if (this.status == 200) {
				callback(JSON.parse(this.responseText));
			}
		};
		xhr.send();
	},
	
	updateConfig: function(defaultConfig) {
		if (localStorage['ChromeLL-Config'] === undefined) {
			localStorage['ChromeLL-Config'] = JSON.stringify(defaultConfig);
			background.config = defaultConfig;
		}
		
		else {
			background.config = JSON.parse(localStorage['ChromeLL-Config']);
			
			for (var i in defaultConfig) {
				// if this variable does not exist, set it to the default
				if (background.config[i] === undefined) {
					background.config[i] = defaultConfig[i];
					if (background.config.debug) {
						console.log("upgrade diff!", i, background.config[i]);
					}
				}
			}		
		}		
		
		if (localStorage['ChromeLL-TCs'] == undefined) {
			localStorage['ChromeLL-TCs'] = "{}";
		}
		
		// beta versions stored TC cache in the global config. Delete if found
		if (background.config.tcs) {
			delete background.config.tcs;
		}				
		
		/**
		 *  Version 1 of imagemap cache used chrome.storage API.
		 *  Version 2 updated the cache to use IndexedDB API.
		 *  Version 3 added a lightweight version of the database (excluding thumbnails)
		 *  	to improve performance.
		 */
		
		// Move image cache from chrome.storage API to indexedDB.
		if (this.config.image_cache_version === 1) {			
			database.open(database.convertCache);
			background.config.image_cache_version = 2;
			localStorage['ChromeLL-Config'] = JSON.stringify(background.config);	
		}
				
		// Create lightweight version of existing database for search purposes
		if (this.config.image_cache_version === 2) {			
			database.open(database.populateSearchObjectStore);
			background.config.image_cache_version = 3;
			localStorage['ChromeLL-Config'] = JSON.stringify(background.config);
		}				
		
		else {		
			// save the config, in case it was updated
			localStorage['ChromeLL-Config'] = JSON.stringify(background.config);
		}
	},
	
	checkVersion: function() {
		var manifest = chrome.runtime.getManifest();
		// notify user if chromeLL has been updated
		if (localStorage['ChromeLL-Version'] != manifest.version 
				&& localStorage['ChromeLL-Version'] != undefined 
				&& this.config.sys_notifications) {
					
			chrome.notifications.create('popup', {
				
					type: "basic",
					title: "ChromeLL has been updated",
					message: "Old v: " + localStorage['ChromeLL-Version'] 
							+ ", New v: " + manifest.version,
					buttons: [{
						title: "Click for more info",
					}],
					iconUrl: "src/images/lueshi_48.png"
					
				}, (id) => {
					
					chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
						
						if (notifId === id && btnIdx === 0) {
							// link user to topic containing changelog and other info
							window.open("http://boards.endoftheinter.net/showmessages.php?topic=9458231");
							chrome.notifications.clear(id, null);
						}
						
					});
					
					setTimeout(function() {
						chrome.notifications.clear(id, null);
					}, 5000);
				}
			);
			
			localStorage['ChromeLL-Version'] = manifest.version;
		}

		if (localStorage['ChromeLL-Version'] == undefined) {
			localStorage['ChromeLL-Version'] = manifest.version;
		}
	},
	
	checkSync: function() {
		chrome.storage.sync.get('config', function(syncData) {
			if (syncData.config && syncData.config.last_saved > background.config.last_saved) {
				// synced config file is more recent than version on computer
				for (var keyName in syncData.config) {					
					background.config[keyName] = syncData.config[keyName];					
				}
				localStorage['ChromeLL-Config'] = JSON.stringify(background.config);
				var bSplit = [];
				for (var k in split) {
					if (background.config[split[k]]) {
						bSplit.push(k);
					}
				}
				chrome.storage.sync.get(bSplit, function(syncConfig) {
					for (var l in syncConfig) {
						background.config[l] = syncConfig[l];
					}
					localStorage['ChromeLL-Config'] = JSON.stringify(background.config);
				});
			}
			
			else if (!syncData.config || syncData.config.last_saved < background.config.last_saved) {
				var localConfig = JSON.parse(localStorage['ChromeLL-Config']);
				var toSet = {};
				for (var i in split) {
					if (background.config[split[i]]) {
						toSet[i] = localConfig[i];
					}
					delete localConfig[i];
				}
				toSet.config = localConfig;
				for (var i in toSet) {
					var f = function(v) {
						chrome.storage.sync.getBytesInUse(v, function(use) {
							// chrome.storage api allows 8,192 bytes per item
							if (use > 8192) {
								var sp = Math.ceil(use / 8192);
								var c = 0;
								for (var j in toSet[v]) {
									if (!toSet[v + (c % sp)]) {
										toSet[v + (c % sp)] = {};
									}
									toSet[v + (c % sp)][j] = toSet[v][j];
									c++;
								}
								delete toSet[v];
							}
						});
					}
					f(i);
				}
				chrome.storage.sync.set(toSet);				
			}
		});
	},
	
	createClipboardElement: function() {
		var backgroundPage = chrome.extension.getBackgroundPage();
		var textArea = backgroundPage.document.createElement("textarea");
		textArea.id = "clipboard";
		backgroundPage.document.body.appendChild(textArea);	
	},
	
	buildContextMenu: function() {
		// imageTransloader method is located in transloader.js
		chrome.contextMenus.create({
			"title": "Transload image",
			"onclick": (info)  => {
				imageTransloader(info);
			},
			"contexts": ["image"]
		});
		
		if (this.config.enable_image_rename) {
			chrome.contextMenus.create({
				"title": "Rename and transload image",
				"onclick": (info) => {
					imageTransloader(info, true);
				},
				"contexts": ["image"]
			});
		}		
		
		chrome.contextMenus.create({
			"title": "Search LUE",
			"onclick": this.contextMenu.searchLUE,
			"contexts": ["selection"]
		});
		
		if (!this.config.simple_context_menu) {					
			
			if (this.config.copy_in_context) {
				chrome.contextMenus.create({
					"title": "Copy img code",
					"onclick": this.contextMenu.imageCopy,
					"documentUrlPatterns": ["*://boards.endoftheinter.net/*", "*://endoftheinter.net/inboxthread.php?*"],
					"contexts": ["image"]
				});
			}			
			
			chrome.contextMenus.create({
				"title": "View image map",
				"onclick": this.contextMenu.imageMap,
				"documentUrlPatterns": ["*://boards.endoftheinter.net/*", "*://endoftheinter.net/inboxthread.php?*"],
				"contexts": ["image"]
			});
			
			for (var i in this.boards) {
				if (this.boards[i] != this.boards[0]) {
					chrome.contextMenus.create({
						"type": "separator",
						"contexts": ["page", "image"]
					});
				}
				for (var j in this.boards[i]) {
					var id = chrome.contextMenus.create({
						"title": j,
						"onclick": this.contextMenu.handleContext,
						"contexts": ["page", "image"]
					});					
					this.board[id] = this.boards[i][j];
				}
			}
			
		}
	},
	
	contextMenu: {
		imageMap: function(info) {
			var str = info.srcUrl;
			var tokens = str.split('/').slice(-2);
			var imageURL = tokens.join('/');
			var imageMap = "http://images.endoftheinter.net/imap/" + imageURL;
			if (background.config.imagemap_new_tab) {
				chrome.tabs.create({
						url: imageMap
				});
			} else {
				chrome.tabs.update({
						url: imageMap
				});
			}
		},
		imageCopy: function(info) {
			var imgURL = info.srcUrl.replace("dealtwith.it", "endoftheinter.net")
			var imgCode = '<img src="' + imgURL + '"/>';
			var clipboard = document.getElementById('clipboard');
			clipboard.value = imgCode;
			clipboard.select();
			document.execCommand("copy");
		},
		searchLUE: function(info) {
			chrome.tabs.create({
					url: "http://boards.endoftheinter.net/topics/LUE?q=" + info.selectionText
			});
		},
		handleContext: function(info) {
			var url = background.board[info.menuItemId];			
			if (!url.match('%extension%')) {
				if (url.match('history.php')) {		
					// no changes necessary
				}
				else {
					url = "http://boards.endoftheinter.net/topics/" + url;	
				}
			}
			else {
			  url = url.replace("%extension%", chrome.extension.getURL("/"));
			}
			
			chrome.tabs.create({
				"url": url
			});			
		}
	},
	
	getDrama: function(callback) {
		const DRAMALINKS_RAW_URL = 'https://wiki.endoftheinter.net/index.php?title=Dramalinks/current&action=raw&section=0&maxage=30';
		
		var xhr = new XMLHttpRequest();
		xhr.open("GET", DRAMALINKS_RAW_URL, true);
		xhr.withCredentials = "true";
		
		xhr.onload = function() {
			switch (this.status) {
				case 200:
					// Make sure that user was logged in & not redirected
					if (this.responseURL === DRAMALINKS_RAW_URL) {
						var scrapedData = background.scrapeDramalinks(this.responseText);
						background.drama.txt = background.buildDramalinksHtml(scrapedData.bgcol, scrapedData.stories);
						background.drama.time = parseInt(new Date().getTime() + (1800 * 1000));						
					}
					else {
						// If we have old drama to display, use that. Otherwise display error message
						if (!background.drama.txt) {
							background.drama.txt = 'Error while loading dramalinks';
						}
					}
					break;
					
				case 404:
					// 10th August 2017 update - seems like Llamaguy fixed the broken redirect. Leaving just in case
					
					// Usually indicates that user was not logged in. The wiki website redirects to the login page on the old ETI domain (luelinks.net), 
					// and the r query parameter contains the URL encoded to base64. As the luelinks.net domain isn't active anymore, we get a 404.
					if (!background.drama.txt) {
						background.drama.txt = 'Error while loading dramalinks';
					}
					break;
					
				default:
					console.log('Unexpected HTTP status code in dramalinks XHR: ' + this.status);
					console.log(this);
					break;
			};
			
			if (callback) {
				callback(background.drama);
			}			
		};
		
		xhr.send();
	},
	
	buildDramalinksHtml: function(level, stories) {
		switch (level) {
			case "kermit":			
				return "Current Dramalinks Level: <font color='white'>CODE KERMIT</font><div style='background-color: black; color: white;'>" + stories + "</div>";
					
			case "black":
			case "blue":
			case "green":
				return "<span style='text-transform:capitalize'>Current Dramalinks Level: <font color='" + level + "'>" + level 
						+ "</font></span><div style='background-color: " + level + "; color: white;'>" + stories + "</div>";
				
			case "lovelinks":
			case "yellow":
			case "orange":
			case "red":
				return "<span style='text-transform:capitalize'>Current Dramalinks Level: <font color='" + level + "'>" + level 
						+ "</font></span><div style='background-color: " + level + "; color: black;'>" + stories + "</div>";
				
			case "errorlinks":
				return "<font face='Lucida Console'>"
						+ "<div style='background-color: blue; color: white;'>" 
						+ "A problem has been detected and ETI has been shut down to prevent damage to your computer."
						+ "<br><br> Technical information: </font>" + stories 
						+ "</div></font>";
				
			default:
				return "<span style='text-transform:capitalize'>Current Dramalinks Level: " + level 
					+ "</font></span><div>" + stories + "</div>";
		}
	},
	
	
	/**
	 *  Scrapes stories from raw dramalinks HTML.
	 */
	 
	scrapeDramalinks: function(responseText) {
		// use base64 string instead of external URL to avoid insecure content warnings for HTTPS users
		const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAMAAAC67D+PAAAAFVBMVEVmmcwzmcyZzP8AZswAZv////////'
				+ '9E6giVAAAAB3RSTlP///////8AGksDRgAAADhJREFUGFcly0ESAEAEA0Ei6/9P3sEcVB8kmrwFyni0bOeyyDpy9JTLEaOhQq7Ongf5FeMhHS/4AVnsAZubx'
				+ 'DVmAAAAAElFTkSuQmCC';
		
		var scrapedData = {};
		
		// Replace wiki-formatted anchors with absolute URLs
		responseText = responseText.replace(/\[\[(.+?)(\|(.+?))\]\]/g, "<a href=\"http://wiki.endoftheinter.net/index.php/$1\">$3</a>");
		responseText = responseText.replace(/\[\[(.+?)\]\]/g, "<a href=\"http://wiki.endoftheinter.net/index.php/$1\">$1</a>");
		
		// Add arrow image to anchors
		responseText = responseText.replace(/\[(.+?)\]/g, "<a href=\"$1\" style=\"padding-left: 0px\"><img src=\"" + png + "\"></a>");
		
		// Fix relative URLs
		responseText = responseText.replace(/href="\/index\.php/g, "href=\"http://wiki.endoftheinter.net/index.php");
		
		// Remove script tags, style attributes and inline event handlers
		responseText = responseText.replace(/style=/gi, "");
		responseText = responseText.replace(/<script/gi, "<i");			
		responseText = responseText.replace(/(on)([A-Za-z]*)(=)/gi, "");
		
		// Scrape stories from response
		responseText = responseText.slice(responseText.indexOf("<!--- NEW STORIES GO HERE --->") + 29);		
		scrapedData.stories = responseText.slice(0, responseText.indexOf("<!--- NEW STORIES END HERE --->"));
		scrapedData.stories = scrapedData.stories.slice(2).replace(/\*/g, "&nbsp;&nbsp;&nbsp;&nbsp;");
		
		// Scrape dramalinks code from response
		responseText = responseText.slice(responseText.indexOf("<!--- CHANGE DRAMALINKS COLOR CODE HERE --->"));
		responseText = responseText.slice(responseText.indexOf("{{") + 2);		
		scrapedData.bgcol = responseText.slice(0, responseText.indexOf("}}")).toLowerCase();
		
		return scrapedData;
	},
	
	notificationData: {},
	
	/** 
	 *  After notification onclick fires, get the stored window/tab id from
	 *  notificationData and focus the window/make the tab active.
	 */
	 
	makeNotificationOriginActive: function(notificationId) {
		if (!this.notificationData[notificationId]) {
			return;
		}
		
		var originatingTab = this.notificationData[notificationId].tab;
		
		chrome.windows.update(originatingTab.windowId, { focused: true }, () => {
			
			chrome.tabs.update(originatingTab.id, { active: true }, () => {
			
				chrome.notifications.clear(notificationId, () => {
					delete this.notificationData[notificationId];
				});
				
			});
		});			
	},
	
	
	/**
	 *  Handles message passing between content scripts and background page
	 */
	
	messagePassing: {
		addListeners: function() {
			// Add listener to handle incoming connections
			chrome.runtime.onConnect.addListener(this.connectToTab.bind(this));
			
			// Handle incoming messages
			chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
			
			// Update badge with ignorator info for active tab
			chrome.tabs.onActivated.addListener(this.updateActiveTab.bind(this));
			
			// Delete references to tab after navigating away from ETI
			chrome.tabs.onUpdated.addListener(this.checkNavigationDest.bind(this));		
			
			// Delete references to tab after closing
			chrome.tabs.onRemoved.addListener(this.deleteTabRefs.bind(this));						
		},
		
		connectToTab: function(port) {
			background.tabPorts[port.sender.tab.id] = {};
			background.tabPorts[port.sender.tab.id] = port;
			
			background.tabPorts[port.sender.tab.id].onMessage.addListener((msg) => {
				background.ignoratorUpdate.call(background, port.sender.tab.id, msg);
			});
		},
		
		updateActiveTab: function(tab) {
			if (background.tabPorts[tab.tabId]) {
				
				try {					
					background.tabPorts[tab.tabId].postMessage({
						action: 'ignorator_update'
					});
				
				} catch(e) {
					// Attempting to use a disconnected port object - remove any references to this tab
					this.deleteTabRefs(tab.tabId);
				}
			}
		},
		
		checkNavigationDest: function(tabId, changeInfo) {
			var newUrl = changeInfo.url;
			if (newUrl && newUrl.indexOf('endoftheinter.net') === -1) {
				this.deleteTabRefs(tabId);
			}			
		},
		
		deleteTabRefs: function(tabId) {
			if (background.tabPorts[tabId]) {
				delete background.tabPorts[tabId];
				delete background.ignoratorInfo[tabId];
				delete background.scopeInfo[tabId];
			}	
		},
		
		handleMessage: function(request, sender, sendResponse) {
			switch(request.need) {
				
				case "xhr":		
					ajax(request, sendResponse);
					// Return true so that we can use sendResponse asynchronously 
					// (See: https://developer.chrome.com/extensions/runtime#event-onMessage)
					return true;
				
				case "config":
					// page script needs extension config.
					background.config = JSON.parse(localStorage['ChromeLL-Config']);
					if (request.sub) {
						sendResponse({"data": background.config[request.sub]});
					} else if (request.tcs) {
						var tcs = JSON.parse(localStorage['ChromeLL-TCs']);
						sendResponse({"data": background.config, "tcs": tcs});
					} else {
						sendResponse({"data": background.config});
					}
					break;
					
				case "save":
					// page script needs config save.
					if (request.name === "tcs") {
						localStorage['ChromeLL-TCs'] = JSON.stringify(request.data);
					} else {
						background.config[request.name] = request.data;
						background.config.last_saved = new Date().getTime();
						localStorage['ChromeLL-Config'] = JSON.stringify(background.config);
					}
					if (background.config.debug) {
						console.log('saving ', request.name, request.data);
					}
					break;
					
				case "notify":
					// Generate unique ID for each tab so we can perform tab-specific actions later
					var id = "notify_" + sender.tab.id;
					
					background.notificationData[id] = {
						tab: sender.tab
					};
					
					chrome.notifications.create(id, {
						type: "basic",
						title: request.title,
						message: request.message,
						iconUrl: "src/images/lueshi_48.png"
					},
					
					(id) => {
						
						if (!background.config.clear_notify) {
							this.config.clear_notify = "5";
						}
						
						if (background.config.clear_notify === "0") {
							return;
						}
						
						setTimeout(() => {
							chrome.notifications.clear(id, null);
							delete background.notificationData[id];
						}, parseInt(background.config.clear_notify, 10) * 1000);
						
					});
					
					break;				
					
				case "progress_notify":
					background.createProgressNotification(request.data);
					break;
					
				case "update_progress_notify":
					background.updateProgressNotification(request.update);
					break;
					
				case "clear_progress_notify":
					background.clearProgressNotification(request.title);
					break;

				case "copy":
					var clipboard = document.getElementById('clipboard');
					clipboard.value = request.data;
					clipboard.select();
					document.execCommand("copy");
					break;
					
				case "dramalinks":
					var time = parseInt(new Date().getTime());
					
					if (background.drama.time && (time < background.drama.time)) {
						sendResponse({"data": background.drama.txt});
					} 
					
					else {
						sendResponse({"data": background.drama.txt});
						background.getDrama();
					}
					
					break;
					
				case "insertcss":
					if (background.config.debug) {
						console.log('inserting css ', request.file);
					}
					chrome.tabs.insertCSS(sender.tab.id, {file: request.file});
					break;
					
				case "opentab":
					if (background.config.debug) {
						console.log('opening tab ', request.url);
					}
					chrome.tabs.create({url: request.url});
					break;
					
				case "noIgnores":
					chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
							sendResponse({"noignores": background.noIgnores});										
					});
					return true;
					
				case "getIgnored":
					chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
							sendResponse({
									"ignorator": background.ignoratorInfo[tabs[0].id], 
									"scope": background.scopeInfo[tabs[0].id]}
							);
					});		
					return true;
					
				case "showIgnorated":
					chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
							
							background.tabPorts[tabs[0].id].postMessage({
									action: 'showIgnorated', 
									type: request.type, 
									value: request.value
							});
					});
					
					return true;
					
				case "options":
					chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
							// check whether bg script can send messages to current tab
							if (background.tabPorts[tabs[0].id] && !background.config.options_window) {
								// Open options page in iframe
								chrome.tabs.sendMessage(tabs[0].id, {
									action: "showOptions"
								}, null);
							}
							
							else {
								// Create new tab
								chrome.runtime.openOptionsPage();						
							}
							
					});
					break;
					
				// Database handlers
					
				case "openDatabase":
					database.open(sendResponse);					
					return true;					
					
				case "convertCacheToDb":
					database.convertCache(sendResponse);					
					return true;
					
				case "queryDb":
					database.get(request.src, sendResponse);
					return true;
					
				case "clearDatabase":
					database.clear(sendResponse);
					return true;
					
				case "addToDatabase":
					database.add(request.data, sendResponse);
					return true;
					
				case "updateDatabase":
					database.updateFilename(request.data.src, request.data.newFilename);
					return true;
					
				case "searchDatabase":
					database.search(request.query, sendResponse);
					return true;
					
				case "getSearchDb":
					database.getSearchObjectStore(sendResponse);
					return true;
					
				case "getAllFromDb":
					database.getAll(sendResponse);
					return true;
					
				case "getDbSize":
					database.getSize(sendResponse);
					return true;
				
				case "getSizeInBytes":
					database.getSizeInBytes(sendResponse);
					return true;
				
				case "getPaginatedObjectStore":
					database.getPaginatedObjectStore(request.page, request.type, sendResponse);
					return true;
					
				default:
					console.log("Error in request listener - undefined parameter?", request);
					break;
			}
		}
	},
	
	createProgressNotification: function(data) {
		chrome.notifications.create('progress', {
			
			type: 'progress',
			title: data.title,
			message: '',
			progress: data.progress,						
			requireInteraction: true,
			iconUrl: 'src/images/lueshi_48.png'
			
		});
	},
	
	updateProgressNotification: function(update) {
		chrome.notifications.update('progress', update);
	},
	
	clearProgressNotification: function(title) {
		chrome.notifications.update('progress', { type: 'basic', title: title, contextMessage: '' });
		
		setTimeout(() => {
			chrome.notifications.clear('progress', null);
		}, 3000);		
	},	
	
	/**
	 *  Checks whether any users have been ignored on active tab and updates badge text
	 */
	 
	ignoratorUpdate: function(tab, msg) {
		switch (msg.action) {
			case "ignorator_update":
				this.ignoratorInfo[tab] = msg.ignorator;
				this.scopeInfo[tab] = msg.scope;
				
				if (msg.ignorator.total_ignored > 0) {				
					chrome.browserAction.setBadgeBackgroundColor({
						tabId: tab,
						color: "#ff0000"
					});
					
					chrome.browserAction.setBadgeText({
						tabId: tab,
						text: "" + msg.ignorator.total_ignored
					});
					
					this.noIgnores = false;
				} 
				
				else {
					this.noIgnores = true;
				}
				
				break;
		}
	},
	
	getUserID: function() {
		var config = JSON.parse(localStorage['ChromeLL-Config']);
		var xhr = new XMLHttpRequest();
		xhr.open("GET", "http://boards.endoftheinter.net/topics/LUE", true);
		xhr.onreadystatechange = function() {
			if (xhr.readyState == 4 && xhr.status == 200) {
				var html = document.createElement('html');
				html.innerHTML = xhr.responseText;
				
				if (html.getElementsByTagName('title')[0].innerText.indexOf("Das Ende des Internets") > -1) {
					// user is logged out
					return;
				}
				
				else {
					var userID = html.getElementsByClassName('userbar')[0]
						.getElementsByTagName('a')[0].href
						.match(/\?user=([0-9]+)/)[1];
						
					config.user_id = userID;
					localStorage['ChromeLL-Config'] = JSON.stringify(config);
					background.scrapeUserProfile(userID);
				}
			}
		}
		xhr.send();
	},
	
	scrapeUserProfile: function(userID) {
		var config = JSON.parse(localStorage['ChromeLL-Config']);
		var url = "http://endoftheinter.net/profile.php?user=" + userID;
		var xhr = new XMLHttpRequest();
				
		xhr.open("GET", url, true);
		xhr.onreadystatechange = function() {
			if (xhr.readyState == 4 && xhr.status == 200) {
				var adminTags, modTags, isAdmin, isMod;
				
				var html = document.createElement('html');
				html.innerHTML = xhr.responseText;
				
				var adminArray, modArray, creationDate;
				var tds = html.getElementsByTagName("td");
				
				for (var i = 0; i < tds.length; i++) {
					var td = tds[i];
					if (td.innerText.indexOf("Administrator of") > -1) {
						adminTags = tds[i + 1].getElementsByTagName('a');
						isAdmin = true;
					}
					if (td.innerText.indexOf("Moderator of") > -1) {
						modTags = tds[i + 1].getElementsByTagName('a');
						isMod = true;
					}
					if (td.innerText.indexOf("Account Created") > -1) {
						creationDate = tds[i + 1].innerHTML;
					}
				}
				
				if (isAdmin) {
					adminArray = Array.prototype.slice.call(adminTags);
				}
				if (isMod) {
					modArray = Array.prototype.slice.call(modTags);
				}
				
				var tagArray = adminArray.concat(modArray);
				
				for (var i = 0, len = tagArray.length; i < len; i++) {
					var tag = tagArray[i].innerText;
					tagArray[i] = tag;
				}
				
				config.tag_admin = tagArray;
				config.creation_date = creationDate;
				
				localStorage['ChromeLL-Config'] = JSON.stringify(config);
				
				if (config.debug) {
					console.log("User Profile = " + url);
					console.log(tagArray);
				}
			}
		}
		xhr.send();
	},
	omniboxSearch: function() {
		var arrayForSearch = [];
		var tags, tag; 
		var tagsForSearch = '';
		var query;
		var searchURL;
		chrome.omnibox.onInputEntered.addListener(function(data) {
			arrayForSearch = data.split('>');
			if (!arrayForSearch[1] && data !== '') {
				query = data;
				searchURL = 'http://boards.endoftheinter.net/topics/?q=' + query;
				chrome.tabs.update({
						url: searchURL
				});
			}
			else {
				tags = arrayForSearch[0].split(',');
				query = arrayForSearch[1];
				if (tags.length === 1) {
					tagsForSearch = tags[0];
				}
				else {
					for (var i = 0, len = tags.length; i < len; i++) {
						tag = tags[i];
						tagsForSearch += tag;
						if (i !== tags.length - 1) {
							// add hex character for plus sign
							tagsForSearch += '%2B';
						}
					}
				}
				searchURL = '	http://boards.endoftheinter.net/topics/' + tagsForSearch + '?q=' + query;
				chrome.tabs.update({
						url: searchURL
				});
			}
		});
	}
};
	
background.getDefaultConfig((config) => {
	background.init.call(background, config);
});

var database = (function() {
	const DB_NAME = 'ChromeLL-Imagemap';
	const DB_VERSION = 2;
	const IMAGE_DB = 'images';
	const SEARCH_DB = 'search';
	const READ_WRITE = 'readwrite';
	var debouncerId;
	var db;			
	
	var open = function(callback) {
		var request = window.indexedDB.open(DB_NAME, DB_VERSION);
		
		request.onsuccess = (event) => {
			db = event.target.result;
			callback();
		};
		
		// Make sure that object stores are up-to-date
		request.onupgradeneeded = (event) => {
			var created = [];
			db = event.target.result;
			
			if (!db.objectStoreNames.contains(IMAGE_DB)) {
				var imageStore = db.createObjectStore(IMAGE_DB, { keyPath: "src" });
				imageStore.createIndex("filename", "filename", { unique: false, multiEntry: true });
				created.push(IMAGE_DB);
			}
			
			if (!db.objectStoreNames.contains(SEARCH_DB)) {
				var imageStore = db.createObjectStore(SEARCH_DB, { keyPath: ["src"] });
				imageStore.createIndex("filename", "filename", { unique: false, multiEntry: true });
				created.push(SEARCH_DB);
			}
			
			if (created.length > 0) {
				console.log('Created new object stores:', created);
			}
			
			chrome.runtime.reload();
		};
	};
	
	var clear = function(callback) {
		
		this.open(() => {
			var transaction = db.transaction([IMAGE_DB, SEARCH_DB], READ_WRITE)
			transaction.objectStore(IMAGE_DB).clear();
			transaction.objectStore(SEARCH_DB).clear();
			callback();
			
		});
	};	
	
	var getStorageApiCache = function(callback) {
		chrome.storage.local.get("imagemap", (cache) => {
			if (typeof cache !== "object" || Object.keys(cache.imagemap).length === 0) {
				callback();
			}
			
			else {
				callback(cache.imagemap);
			}				
		});
	};
	
	
	/**
	 *  Creates a new object store (SEARCH_DB) which clones IMAGE_DB, but only includes the 
	 *  filenames and image src attributes. This greatly increases the performance of the 
	 *  search() method (up to 5x faster)
	 */
	 
	var populateSearchObjectStore = function() {
		var transaction = db.transaction([SEARCH_DB], READ_WRITE);

		transaction.onerror = (event) => {
			console.log(event.target.error.message);
		};
		
		transaction.onsuccess = getAll((imageData) => {
			var transaction = db.transaction([SEARCH_DB], READ_WRITE);
			var objectStore = transaction.objectStore(SEARCH_DB);	
						
			// Remove thumbnail data, add index and add to SEARCH_DB
			for (let i = 0, len = imageData.length; i < len; i++) {
				var data = imageData[i];	
				delete data.data;
				delete data.fullsize;
				var request = objectStore.add(data);
			}
			
		});
		
	};
	
	var getSearchObjectStore = function(callback) {
		var objectStore = db.transaction(SEARCH_DB).objectStore(SEARCH_DB);
		// Note: getAll() method isn't part of IndexedDB standard and may disappear in future.
		if (objectStore.getAll != null) {
			var request = objectStore.getAll();
			
			request.onsuccess = (event) => {
				// TODO: Need to test what happens if database exists but is empty
				callback(event.target.result);
			};
			
			request.onerror = (event) => {
				callback(false);
			};
		}
		
		else {				
			var cache = [];
			objectStore.openCursor().onsuccess = (event) => {
				var cursor = event.target.result;
				if (cursor) {
					cache.push(cursor.value);
					cursor.continue();
				}
				else {
					callback(cache);
				}
			};								
		}
	};
	
	var getPaginatedObjectStore = function(page, type, callback) {
		var objectStore = db.transaction(type).objectStore(type);
		var rangeStart = page * 50 - 50;
		var rangeEnd = page * 50;
		var results = [];
		var index = 0;
		
		objectStore.openCursor().onsuccess = (event) => {
			var cursor = event.target.result;
			
			if (cursor && index < rangeEnd) {
				
				if (index > rangeStart) {
					results.push(cursor.value);
				}
				
				index++;				
				cursor.continue();
			}
			
			else {
				callback(results);
			}
		};
	};
	
	
	/**
	 *	Converts old cache to new cache which uses IndexedDB API instead of chrome.storage API
	 */	
	
	var convertCache = function(callback) {
	
		getStorageApiCache((imagemap) => {
			
			if (imagemap && Object.keys(imagemap).length > 0) {
				var imageObjectStore = db.transaction(IMAGE_DB, READ_WRITE).objectStore(IMAGE_DB);	
				
				for (var src in imagemap) {
					var record = imagemap[src];
					
					// We need to manually add src property to object before adding to database
					record.src = src;
					imageObjectStore.add(record);
				}
															
				// At this point we can safely clear chrome.storage
				chrome.storage.local.clear();
			}
			
		});	
	};
	
	var get = function(src, callback) {
		var request = db.transaction(IMAGE_DB)
				.objectStore(IMAGE_DB)
				.get(src);		
					
		request.onsuccess = (event) => {
			if (event.target.result) {
				callback(event.target.result);
			}
			else {				
				callback(false);
			}
		};
		
		request.onerror = (event) => {
			// Couldn't find src in database.
			callback(false);
		};
	};
	
	var add = function(data) {
		var transaction = db.transaction([IMAGE_DB, SEARCH_DB], READ_WRITE);

		transaction.onerror = (event) => {
			// Can't use add() method if src already exists in database.
			console.log(event.target.error.message);
		};

		var imageStore = transaction.objectStore(IMAGE_DB);
		var searchStore = transaction.objectStore(SEARCH_DB);
		
		for (var src in data) {
			// Add full image data to IMAGE_DB
			imageStore.add(data[src]);
			
			// Delete base64 thumbnail and fullsize URL and add to SEARCH_DB
			var trimmedData = data[src];
			delete trimmedData.data;
			delete trimmedData.fullsize;			
			searchStore.add(trimmedData);
		}		
	};
	
	var updateFilename = function(src, newFilename) {
		var transaction = db.transaction([IMAGE_DB], READ_WRITE);
		
		transaction.onerror = (event) => {
			console.log(event.target.error.message);
		};

		var objectStore = transaction.objectStore(IMAGE_DB);
		
		var record = objectStore.get(src);
		
		record.onsuccess = () => {
			var data = record.result;				
			data.filename = newFilename;				
			var updateTitleRequest = objectStore.put(data);
		};
	};
	
	
	/**
	 *  Iterates through SEARCH_DB object store and calls back with an array containing any matches.
	 */ 
	
	var search = function(query, callback) {
		var results = [];
		var transaction = db.transaction(SEARCH_DB);
		var objectStore = transaction.objectStore(SEARCH_DB);							
		
		// TODO: Maybe we should open cursor after checking whether index returns any exact matches		
		var request = objectStore.openCursor();
		
		// Check first characters if query length < 3, otherwise look for matches anywhere
		if (query.length < 3) {
			
			request.onsuccess = (event) => {
					var cursor = event.target.result;
					
					if (cursor) {
							// Only check first character
							if (cursor.value.filename.indexOf(query) === 0) {
									results.push(cursor.value);
							}

							cursor.continue();          
					}
					
					else {
						// Reached end of db
						retrieveImageData(results, query, callback);
					}
			};								
		}
		
		else {
			request.onsuccess = (event) => {
					var cursor = event.target.result;
					
					if (cursor) {			
							if (cursor.value.filename.indexOf(query) !== -1) {
									results.push(cursor.value);
							}

							cursor.continue();          
					}
					
					else {
						// Reached end of db
						retrieveImageData(results, query, callback);
					}
			};			
		}
	};
	
	
	/**
	 *  Returns image data from IMAGE_DB for given search results	 
	 */
	
	var retrieveImageData = function(results, query, callback) {
		var imageData = [];
		
		for (let i = 0, len = results.length; i < len; i++) {
			var result = results[i];
			get(result.src, (data) => {
				
				imageData.push(data);
				
				if (imageData.length === results.length) {
					callback(imageData, query);
				}
				
			});
		}
	};
	
	var getAll = function(callback) {
		var objectStore = db.transaction(IMAGE_DB).objectStore(IMAGE_DB);
		// Note: getAll() method isn't part of IndexedDB standard and may disappear in future.
		if (objectStore.getAll != null) {
			var request = objectStore.getAll();
			
			request.onsuccess = (event) => {
				// TODO: Need to test what happens if database exists but is empty
				callback(event.target.result);
			};
			
			request.onerror = (event) => {
				callback(false);
			};
		}
		
		else {				
			var cache = [];
			objectStore.openCursor().onsuccess = (event) => {
				var cursor = event.target.result;
				if (cursor) {
					cache.push(cursor.value);
					cursor.continue();
				}
				else {
					callback(cache);
				}
			};								
		}
	};
	
	var getSize = function(callback) {
		var objectStore = db.transaction(SEARCH_DB).objectStore(SEARCH_DB);
		var count = objectStore.count();
		
		count.onsuccess = () => {
			callback(count.result);
		};
	};
	
	var getSizeInBytes = function(callback) {
		var size = 0;

		var transaction = db.transaction([IMAGE_DB])
				.objectStore(IMAGE_DB)
				.openCursor();

		transaction.onsuccess = (event) => {
			var cursor = event.target.result;
			if (cursor) {
				var storedObject = cursor.value;
				var json = JSON.stringify(storedObject);
				size += json.length;
				cursor.continue();
			}
			else {
				callback(size);
			}
		};
		
		transaction.onerror = (err) => {
			// Callback with value of -1MB (to make it obvious that something went wrong without breaking anything)
			callback(-1048576);
		};
	};
	
	return {
		open: open,
		clear: clear,
		convertCache: convertCache,
		populateSearchObjectStore: populateSearchObjectStore,
		getPaginatedObjectStore: getPaginatedObjectStore,
		get: get,
		add: add,
		updateFilename: updateFilename,
		search: search,
		getSearchObjectStore: getSearchObjectStore,
		getAll: getAll,
		getSize: getSize,
		getSizeInBytes: getSizeInBytes,
		db: db	
	};
	
})();

var ajaxCache = {};

var ajax = function(request, callback) {
	// Check xhrCache before creating new XHR.
	var url = request.url;
	var currentTime = new Date().getTime();
	
	if (!request.ignoreCache && ajaxCache[url]
			&& currentTime < ajaxCache[url].refreshTime) {
				
		// Return cached response
		callback(ajaxCache[url].data);
	}
	
	else {
		var TWENTY_FOUR_HOURS = 86400000; // 24 hours in milliseconds
		var type = request.type || 'GET';
		var xhr = new XMLHttpRequest();
		xhr.requestURL = url;
		xhr.open(type, request.url, true);
		
		if (request.noCache) {
			xhr.setRequestHeader('Cache-Control', 'no-cache');
		}
		if (request.auth) {
			xhr.setRequestHeader('Authorization', request.auth);
		}
		if (request.withCredentials) {
			xhr.withCredentials = "true";
		}
		
		xhr.onload = function() {
			switch(this.status) {
				case 200:
					if (!request.ignoreCache) {
						// Cache response and check again after 24 hours
						ajaxCache[this.requestURL] = {
							data: this.responseText,
							refreshTime: currentTime + TWENTY_FOUR_HOURS
						};
					}
					
					callback(this.responseText);
					break;
					
				default:				
					callback(this.responseText);
					break;
			}
		};
		
		xhr.send();		
	}
};
