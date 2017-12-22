$(document).ready(() => {
	
	$('.options_navigation_link')
		.click(function() {
			
			toLink = $(this)
					.attr('id')
					.split('_link')[0];

			selectedPage = $('.navbar-item-selected')
					.attr("id")
					.split('_link')[0];

			if (toLink == selectedPage) {
				return true;
			}

			$('#' + selectedPage + '_link')
					.removeClass("navbar-item-selected");
					
			$('#' + toLink + '_link')
					.addClass("navbar-item-selected");

			$('#' + selectedPage + '_page')
					.removeClass("shown")
					.addClass("hidden");
					
			$('#' + toLink + '_page')
						.removeClass("hidden")
						.addClass("shown");

			$('body')
					.css("background-color", "transparent");
			
		}
	);
	
	// It's possible (but unlikely) that user opened options before background page finished loading config
	
	if (localStorage['ChromeLL-Config'] == ''
			|| localStorage['ChromeLL-Config'] == undefined) {				
		console.log("Blank Config. Rebuilding");
		
		options.getDefault(function(defaultConfig) {				
			localStorage['ChromeLL-Config'] = defaultConfig;
			options.init();
		});					
	}
	
	else if (localStorage['chromeLL_userhighlight'] && 
			localStorage['chromeLL_userhighlight'] != '') {		
		options.restoreV1();
	}
	else {
		options.init();
	}
	
});

var options = {
	init: function() {
		console.log('loading config');
		var config = JSON.parse(localStorage['ChromeLL-Config']);
		var checkboxes = $(":checkbox");
		for ( var i in checkboxes) {
			checkboxes[i].checked = config[checkboxes[i].id];
		}
		var textboxes = $(":text");
		for (var i in textboxes) {
			if (textboxes[i].name
					&& (textboxes[i].name.match('(user|keyword|tag)_highlight_') 
							|| textboxes[i].name.match('user_book') 
							|| textboxes[i].name.match('snippet') 
							|| textboxes[i].name.match('rep_ignore') 
							|| textboxes[i].name.match('users') 
							|| textboxes[i].name.match('token') 
							|| textboxes[i].name.match('post_template'))) {
				// console.log('found a textbox to ignore: ' + textboxes[i]);
			} else if (config[textboxes[i].id]) {
				textboxes[i].value = config[textboxes[i].id];
			}
		}
		for ( var j in config.user_highlight_data) {
			document.getElementsByClassName('user_name')[document
					.getElementsByClassName('user_name').length - 1].value = j;
			document.getElementsByClassName('header_bg')[document
					.getElementsByClassName('header_bg').length - 1].value = config.user_highlight_data[j].bg;
			document.getElementsByClassName('header_color')[document
					.getElementsByClassName('header_color').length - 1].value = config.user_highlight_data[j].color;
			options.ui.addDiv.userHighlight();
		}
		for ( var j in config.bookmark_data) {
			document.getElementsByClassName('bookmark_name')[document
					.getElementsByClassName('bookmark_name').length - 1].value = j;
			document.getElementsByClassName('bookmark_tag')[document
					.getElementsByClassName('bookmark_tag').length - 1].value = config.bookmark_data[j];
			options.ui.addDiv.bookmarkName();
		}
		for ( var j in config.snippet_data) {
			document.getElementsByClassName('snippet_name')[document
					.getElementsByClassName('snippet_name').length - 1].value = j;
			document.getElementsByClassName('snippet')[document
					.getElementsByClassName('snippet').length - 1].value = config.snippet_data[j];
			options.ui.addDiv.snippetName();
		}
		for (var j = 0; config.keyword_highlight_data[j]; j++) {
			document.getElementsByClassName('keyword')[document
					.getElementsByClassName('keyword').length - 1].value = config.keyword_highlight_data[j].match;
			document.getElementsByClassName('keyword_bg')[document
					.getElementsByClassName('keyword_bg').length - 1].value = config.keyword_highlight_data[j].bg;
			document.getElementsByClassName('keyword_color')[document
					.getElementsByClassName('keyword_color').length - 1].value = config.keyword_highlight_data[j].color;
			options.ui.addDiv.keywordHighlight();
		}
		for (var j = 0; config.tag_highlight_data[j]; j++) {
			document.getElementsByClassName('tag')[document
					.getElementsByClassName('tag').length - 1].value = config.tag_highlight_data[j].match;
			document.getElementsByClassName('tag_bg')[document
					.getElementsByClassName('tag_bg').length - 1].value = config.tag_highlight_data[j].bg;
			document.getElementsByClassName('tag_color')[document
					.getElementsByClassName('tag_color').length - 1].value = config.tag_highlight_data[j].color;
			options.ui.addDiv.tagHighlight();
		}
		for ( var j in config.post_template_data) {
			document.getElementsByClassName('template_text')[document
					.getElementsByClassName('template_text').length - 1].value = config.post_template_data[j].text;
			document.getElementsByClassName('template_title')[document
					.getElementsByClassName('template_title').length - 1].value = j;
			options.ui.addDiv.postTemplate();
		}
		document.getElementById('clear_notify').value = config.clear_notify;		
		// show version
		var manifest = chrome.runtime.getManifest();
		document.getElementById('version').innerText = manifest.version;
		document.getElementById('downloadcfg').href = options.download();

		var cssBox = document.getElementById('fun_css_div');
		if (config.user_id == 13547 || config.user_id == 5599) {
			cssBox.style.display = 'block';			
		}		
		if (document.readyState == 'loading') {
			
			document.addEventListener('DOMContentLoaded', function() {
				options.ui.hideUnusedMenus();
				options.ui.setColorPicker();
				
				options.addListeners.menuVisibility();
				options.addListeners.click();
				options.addListeners.change();
				options.addListeners.keyup();
				
				options.ui.populateCacheSize();
				options.ui.populateCacheTable();	
				
				options.ui.displayLBContent();
				
				options.save();
			});
		} 
		
		else {
			options.ui.hideUnusedMenus();
			options.ui.setColorPicker();
			
			options.addListeners.menuVisibility();
			options.addListeners.click();
			options.addListeners.change();
			options.addListeners.keyup();			
			
			options.ui.populateCacheSize();
			options.ui.populateCacheTable();	
			
			options.ui.displayLBContent();
			
			options.save();
		}		
	},	
	utils: {
		cleanIgnorator: function() {
			var config = JSON.parse(localStorage['ChromeLL-Config']);
			var rateLimiterResponse = this.checkRateLimit();
			
			if (config.ignorator_list == "") {
				document.getElementById('ignorateinfo').innerText = "no ignorator list found..."
				return;
			}			
			
			else if (rateLimiterResponse) {
				document.getElementById('ignorateinfo').innerText = "try again in " + rateLimiterResponse;
				return;
			}

			else {
				document.getElementById('ignorateinfo').innerText = "running ignorator cleaner..."
			}
			
			config.ignorator_backup = config.ignorator_list;
			localStorage['ChromeLL-Config'] = JSON.stringify(config);
			
			var list = config.ignorator_list;
			var oldIgnorator = list.split(',');
			for (var i = 1; oldIgnorator[i]; i++) {
				oldIgnorator[i] = oldIgnorator[i].trim();
			}
			
			$.confirm({
				text: "Remove banned users?",
				
				confirm: () => {					
					this.sendCleanerRequest({ "userList": oldIgnorator, "removeBanned": true });
				},
				
				cancel: () => {
					this.sendCleanerRequest({ "userList": oldIgnorator, "removeBanned": false });
				},
				
				confirmButton: "Yes",
				cancelButton: "No"
			});
		},
		
		sendCleanerRequest: function(json) {				
			const url = 'http://eti-stats.herokuapp.com/tools/api/clean_ignorator/';
			var xhr = new XMLHttpRequest();
			xhr.open("POST", url, true);		
			xhr.setRequestHeader('Content-Type', 'application/json');		
			xhr.onload = this.handleResponse;		
			xhr.send(JSON.stringify(json));	
		},
		
		handleResponse: function() {
			var config = JSON.parse(localStorage['ChromeLL-Config']);
			// Note: 'this' is reference to XHR object
			switch (this.status) {
				case 200:
					var temp = JSON.parse(this.responseText);
					var users = temp.userList;
					var newIgnorator = users.toString();
					config.ignorator_list = newIgnorator;
					
					config.last_clean = new Date().getTime();			
					localStorage['ChromeLL-Config'] = JSON.stringify(config);					
					
					document.getElementById('ignorator_list').value = newIgnorator.toString();
					document.getElementById('ignorateinfo').innerText = "ignorator cleaned.";
					
					break;																
					
				case 503:
					document.getElementById('ignorateinfo').innerText = "eti-stats is down - try again later";
					break;
			
				default:
					// Probably an error - display responseText
					document.getElementById('ignorateinfo').innerText = this.responseText;
					break;
			}
		},
		
		checkRateLimit: function() {
			var config = JSON.parse(localStorage['ChromeLL-Config']);

			var currentTime = new Date().getTime();
			var timeLeft = currentTime - config.last_clean;
			
			if (timeLeft > 86400000) {
				return;				
			}
			
			else {
				var totalseconds = ((86400000 - timeLeft) / 1000);
				var hours = Math.floor(totalseconds / 3600);
				var totalminutes = Math.floor(totalseconds / 60);
				var minutes = totalminutes - (hours * 60);
				var seconds = Math.floor(totalseconds - (totalminutes * 60));
				
				if (hours === 1) {
					hours = hours + " hour, ";
				} 
				
				else {
					hours = hours + " hours, ";
				}
				
				
				if (minutes === 1) {
					minutes = minutes + " minute, and ";
				} 
				
				else {
					minutes = minutes + " minutes, and ";
				}
				
				
				if (seconds === 1) {
					seconds = seconds + " second.";
				}

				else {
					seconds = seconds + " seconds."
				}
				
				return hours + minutes + seconds;
			}
		},
		restoreIgnorator: function() {
			var config = JSON.parse(localStorage['ChromeLL-Config']);
			var backup = config.ignorator_backup;
			
			$.confirm({
					text: "Are you sure you want to restore last ignorator backup?",
					
					confirm: () => {					
						if (backup == "") {
							document.getElementById('ignorateinfo').innerHTML = "no backup found...";
							return;
						} 
						
						else if (backup == config.ignorator_list) {
							document.getElementById('ignorateinfo').innerHTML = "current list and backup are identical...";
							return;
						} 
						
						else {
							config.ignorator_list = backup;
							localStorage['ChromeLL-Config'] = JSON.stringify(config);
							
							document.getElementById('ignorator_list').value = backup.toString();
							document.getElementById('ignorateinfo').innerHTML = "backup restored.";
						}					
					},
					
					cancel: () => {
						return;
					}
			});
		},
		ignoratorClick: function() {
			var ignorator = document.getElementById('ignorator');
			document.getElementById('ignorator_messagelist').checked = ignorator.checked;
			document.getElementById('ignorator_topiclist').checked = ignorator.checked;
			options.save();
		},
		highlightClick: function() {
			var highlight = document.getElementById('enable_user_highlight');
			document.getElementById('userhl_messagelist').checked = highlight.checked;
			document.getElementById('userhl_topiclist').checked = highlight.checked;
			options.save();
		},
		downloadClick: function() {
			document.getElementById('downloadcfg').click();
		},
		restoreClick: function() {
			document.getElementById('restorecfg').click();
		},		
		showTextarea: function() {
			document.getElementById('old_cfg_options').style.display = "none";
			document.getElementsByClassName('old_cfg_options')[0].style.display = "inline";			
			options.show();
		},		
		processConfig: function(textfile) {
			var base64;
			try {
				if (typeof textfile === 'string') {
					newCfg = JSON.parse(textfile);
				}
				else if (document.getElementById('cfg_ta').value != '') {
					newCfg = JSON.parse(document.getElementById('cfg_ta').value);
				}		
				var myCfg = JSON.parse(localStorage['ChromeLL-Config']);
				for (var i in newCfg) {
					myCfg[i] = newCfg[i];				
				}
				myCfg.last_saved = new Date().getTime();
				localStorage['ChromeLL-Config'] = JSON.stringify(myCfg);
			} catch (e) {
				console.log('This doesnt look like a config', e);
				base64 = options.utils.decodeBase64(document.getElementById('cfg_ta').value);
				options.restoreV1(base64);
			}
			location.reload();
		},
		
		resetConfig: function() {
			$.confirm({
					text: "Are you sure you want to reset your settings?",
					
					confirm: () => {					
						options.getDefault(function(defaultCfg) {
							localStorage['ChromeLL-Config'] = defaultCfg;
							location.reload();
						});					
					},
					
					cancel: () => {
						return;
					}
			});
		},
		
		decodeBase64: function() {
			var Base64 = {
				_keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
				decode: function(input) {
					var output = "";
					var chr1, chr2, chr3;
					var enc1, enc2, enc3, enc4;
					var i = 0;

					input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

					while (i < input.length) {

						enc1 = this._keyStr.indexOf(input.charAt(i++));
						enc2 = this._keyStr.indexOf(input.charAt(i++));
						enc3 = this._keyStr.indexOf(input.charAt(i++));
						enc4 = this._keyStr.indexOf(input.charAt(i++));

						chr1 = (enc1 << 2) | (enc2 >> 4);
						chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
						chr3 = ((enc3 & 3) << 6) | enc4;

						output = output + String.fromCharCode(chr1);

						if (enc3 != 64) {
							output = output + String.fromCharCode(chr2);
						}
						if (enc4 != 64) {
							output = output + String.fromCharCode(chr3);
						}

					}

					output = Base64._utf8_decode(output);

					return output;

				},
				_utf8_decode: function(utftext) {
					var string = "";
					var i = 0;
					var c = c1 = c2 = 0;

					while (i < utftext.length) {

						c = utftext.charCodeAt(i);

						if (c < 128) {
							string += String.fromCharCode(c);
							i++;
						} else if ((c > 191) && (c < 224)) {
							c2 = utftext.charCodeAt(i + 1);
							string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
							i += 2;
						} else {
							c2 = utftext.charCodeAt(i + 1);
							c3 = utftext.charCodeAt(i + 2);
							string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
							i += 3;
						}

					}

					return string;
				}
			}
			return JSON.parse(Base64.decode(config));
		},
		
		emptyCache: function() {
			
			$.confirm({
				text: "Clear image cache?",
				
				confirm: () => {	
					chrome.runtime.sendMessage({ need: 'clearDatabase' }, () => {
				// Update UI
				options.ui.clearCacheTable();
				options.ui.populateCacheSize();
				options.ui.populateCacheTable();			
			});
		},
		
				cancel: () => {
					// Do nothing
				}
				
			});

		},
		
		newLike: function() {
			var textarea = document.getElementById('like_ta');
			var activeLike = document.getElementsByClassName('active_like')[0];
			var config = JSON.parse(localStorage['ChromeLL-Config']);
			var likeData = config.custom_like_data;	
			var highest = 1;
			for (var i in likeData) {
				var current = parseInt(i.match(/[0-9]+/)[0], 10);
				if (current > highest) {
					highest = current;
				}
			}
			
			var newNumber;
			
			if (activeLike) {
				newNumber = highest + 1;
			}
			
			else {
				newNumber = 1;
			}
			
			var newID = 'like' + newNumber;
			
			config.custom_like_data[newID] = {};
			config.custom_like_data[newID].name = 'Untitled ' + newNumber;
			config.custom_like_data[newID].contents = '<img src="http://i4.endoftheinter.net/i/n/f818de60196ad15c888b7f2140a77744/like.png" />' + '\n'
					+ "[user] likes [poster]'s post";			
					
			textarea.value = config.custom_like_data[newID].contents;
			
			var likeList = document.getElementById('like_list');
			var anchor = document.createElement('a');
			var linebreak = document.createElement('br');
			anchor.href = '#';
			anchor.id = newID;
			anchor.className = 'active_like';
			anchor.innerHTML = 'Untitled ' + newNumber;
			var close = document.createElement('a');
			close.style.cssFloat = "right";
			close.style.fontSize = "18px";
			close.href = '#';
			close.style.textDecoration = "none";
			close.id = "delete_custom";
			close.innerHTML = '&#10006;';
			anchor.appendChild(close);
			likeList.appendChild(anchor);
			likeList.appendChild(linebreak);
			if (activeLike) {
				activeLike.className = '';
			}			
			localStorage['ChromeLL-Config'] = JSON.stringify(config);			
		},
		
		saveLike: function() {
			var config = JSON.parse(localStorage['ChromeLL-Config']);	
			var activeLike = document.getElementsByClassName('active_like')[0];
			var contents = document.getElementById('like_ta').value;			
			var name = activeLike.firstChild.innerText;
			var id = activeLike.id;
			
			config.custom_like_data[id].contents = contents;
			config.custom_like_data[id].last_saved = Date.now();
			localStorage['ChromeLL-Config'] = JSON.stringify(config);
		},		
		
		renameLike: function() {
			var config = JSON.parse(localStorage['ChromeLL-Config']);	
			var activeLike = document.getElementsByClassName('active_like')[0];			
			var oldName = activeLike.firstChild.nodeValue;
			var id = activeLike.id;
			
			// We can't use window.prompt() from inside chrome://extensions						
			
			if (window.location.protocol === 'chrome-extension:') {
								
				var nameInput = document.createElement('input');
				nameInput.id = 'like_rename_input';
				nameInput.setAttribute('placeholder', oldName);
				nameInput.setAttribute('size', 15);
				activeLike.replaceChild(nameInput, activeLike.firstChild);
				
				nameInput.addEventListener('keydown', (event) => {
					
					if (event.keyCode === 13) {
						
						var newName = nameInput.value;
						
						if (!newName || !/\S/.test(newName)) {
							var displayNode = document.createTextNode(oldName);
							activeLike.replaceChild(displayNode, activeLike.firstChild);
						}
						
						else {						
							var displayNode = document.createTextNode(newName);
							activeLike.replaceChild(displayNode, activeLike.firstChild);
							
							config.custom_like_data[id].name = newName;
							config.custom_like_data[id].last_saved = Date.now();
							localStorage['ChromeLL-Config'] = JSON.stringify(config);						
						}
					}
					
				});
			}
			
			else {
				var newName = prompt("Enter new name", oldName);
				
				if (!newName || !/\S/.test(newName)) {
					return;
				}						
			
				else {
					activeLike.firstChild.nodeValue = newName;					
					config.custom_like_data[id].name = newName;
					config.custom_like_data[id].last_saved = Date.now();
					localStorage['ChromeLL-Config'] = JSON.stringify(config);
				}			
			}
		},

		deleteFromConfig: function(id) {
			var config = JSON.parse(localStorage['ChromeLL-Config']);
			var type = id.replace(/[0-9]/g, '');
			// TODO - refactor this function
			var lastKeyInObject;
			var active = document.getElementsByClassName('active_' + type).length;
			var inactive = document.getElementsByClassName('inactive_' + type).length;
			if (type == 'like') {
				delete config.custom_like_data[id];
				cleanup(config.custom_like_data);
			}
			var nodeToRemove = document.getElementById(id);
			if (nodeToRemove.className == 'active_' + type) {
				var nextActive = document.getElementsByClassName('inactive_' + type);
				if (nextActive.length > 0) {
					nextActive[0].className = 'active_' + type;
				}
				nodeToRemove.className = '';
			}
			var closeButton = nodeToRemove.childNodes[0];
			nodeToRemove.remove();
			closeButton.remove();
			localStorage['ChromeLL-Config'] = JSON.stringify(config);
			
			function cleanup(data) {
				// rebuild object so that IDs are always in consecutive numeric order
				// (type1, type2, type3, etc)
				var newIndex = 1;
				for (var i in data) {
					data[type + newIndex] = data[i];
					if (i !== type + newIndex) {
						delete data[i];
					}
				}
			}
		}
	},
	addListeners: {
		keyup: function() {	
			document.addEventListener('keyup', function(evt) {
				if (evt.target.name == "user_highlight_username") {
					var datas = document.getElementById('user_highlight')
							.getElementsByClassName('user_name');
					var empty = false;
					for (var i = 1; datas[i]; i++) {
						if (datas[i].value == '')
							empty = true;
					}
					if (!empty)
						options.ui.addDiv.userHighlight();
				}

				if (evt.target.name == "user_book_name") {
					var datas = document.getElementById('bookmarked_tags')
							.getElementsByClassName('bookmark_name');
					var empty = false;
					for (var i = 1; datas[i]; i++) {
						if (datas[i].value == '')
							empty = true;
					}
					if (!empty)
						options.ui.addDiv.bookmarkName();
				}
				
				if (evt.target.name == "user_snippet") {
					var datas = document.getElementById('snippets')
							.getElementsByClassName('snippet_name');
					var empty = false;
					for (var i = 1; datas[i]; i++) {
						if (datas[i].value == '')
							empty = true;
					}
					if (!empty)
						options.ui.addDiv.snippetName();
				}

				if (evt.target.name == "post_template_title") {
					var datas = document.getElementById('post_template')
							.getElementsByClassName('template_title');
					var empty = false;
					for (var i = 1; datas[i]; i++) {
						if (datas[i].value == '')
							empty = true;
					}
					if (!empty)
						options.ui.addDiv.postTemplate();
				}
				if (evt.target.name == "keyword_highlight_keyword") {
					var datas = document.getElementById('keyword_highlight')
							.getElementsByClassName('keyword');
					var empty = false;
					for (var i = 1; datas[i]; i++) {
						if (datas[i].value == '')
							empty = true;
					}
					if (!empty)
						options.ui.addDiv.keywordHighlight();
				}
				if (evt.target.name == "tag_highlight_keyword") {
					var datas = document.getElementById('tag_highlight')
							.getElementsByClassName('tag');
					var empty = false;
					for (var i = 1; datas[i]; i++) {
						if (datas[i].value == '')
							empty = true;
					}
					if (!empty)
						options.ui.addDiv.tagHighlight();
				}
			});
		},
		click: function() {
			// key-value pairs contain element id and function for event handler
			var elementsToCheck = {
				'ignorator': 'ignoratorClick',
				'enable_user_highlight': 'highlightClick',
				'loadcfg': 'processConfig',
				'resetcfg': 'resetConfig',
				'forceignorator': 'cleanIgnorator',
				'restoreignorator': 'restoreIgnorator',
				'downloadbutton': 'downloadClick',
				'restorebutton': 'restoreClick',
				'old_cfg_options': 'showTextarea',
				'cache_empty': 'emptyCache',
				'script_new': 'newScript',
				'script_save':  'saveScript',
				'like_new': 'newLike',
				'like_rename': 'renameLike',
				'like_save':  'saveLike'				
			};
			
			document.addEventListener('click', function(evt) {
				var elementID = evt.target.id;
				if (elementsToCheck[elementID]) {
					var functionName = elementsToCheck[elementID];
					options.utils[functionName]();
					if (evt.target.tagName !== 'INPUT') {
						evt.preventDefault();
					}
				}
				
				if (elementID === 'open_cache') {
					
					document.getElementById('open_cache').style.display = 'none';
					document.getElementById('cache_table').style.display = 'block';
					options.ui.populateCacheTable();										
					
				};
				
				if (evt.target.className === 'cache_url_original') {
					
					options.imageCache.open(() => {
						
						chrome.runtime.sendMessage({
						
							need: 'queryDb',
							src: evt.target.id
							
						}, (result) => {
							
							window.open(result.fullsize);
							
						});
					});
				}
				
				if (evt.target.className === 'cache_url_thumbnail') {
					
					options.imageCache.open(() => {
						
						chrome.runtime.sendMessage({
						
							need: 'queryDb',
							src: evt.target.id
							
						}, (result) => {
							
							window.open(result.data);
							
						});			
					});
				}
				
				if (evt.target.parentNode.id.match(/_list/) && evt.target.className != 'delete') {
					var parent = evt.target.parentNode.id;
					var type = evt.target.id.replace(/[0-9]/g, '');
					var next = evt.target;
					var last = document.getElementsByClassName('active_' + type)[0];
					if (last) {
						last.className = '';
					}
					next.className = 'active_' + type;
					options.ui.switchActive(evt.target.id);
					evt.preventDefault();
				}
				
				else if (evt.target.id == 'delete_custom') {
					options.utils.deleteFromConfig(evt.target.parentNode.id);
					evt.preventDefault();
				}
			});
		},
		change: function() {
			var restoreButton = document.getElementById('restorecfg');
			var cacheTable = document.getElementById('cache_contents');
			var cacheMenu = document.getElementById('cache_sort');
			var scriptArea = document.getElementById('script_ta');
			var keyupTimer, cacheTimer, searchTimer;		

			restoreButton.addEventListener('change', function(evt) {
				options.restoreFromText(evt);
			});	
			
			cacheTable.addEventListener('keyup', function(evt) {
				if (evt.target.value !== 'imagemap_search') {
					var newFilename = evt.target.value;
					var src = evt.target.id;
					
					clearTimeout(cacheTimer);
					
					cacheTimer = setTimeout(() => {
						
						chrome.runtime.sendMessage({
							
							need: 'updateDatabase',
							data: {
								src: src,
								newFilename: newFilename								
							}
							
						});
						
					}, 500);
				
				}
			});
			
			cacheMenu.addEventListener('change', function(evt) {
				if (evt.target.value) {
					options.imageCache.sort(evt.target.value);		
				}
			});
			
			// listen for changes to checkboxes/textareas/etc
			document.addEventListener('change', options.save);
			
			// use debouncing to prevent script from calling event handler after each keystroke
			document.addEventListener('keyup', function(evt) {
				if (evt.target.id == 'imagemap_search') {
					clearTimeout(searchTimer);
					searchTimer = setTimeout(options.imageCache.search, 500);
				}
				else {
					clearTimeout(keyupTimer);
					keyupTimer = setTimeout(options.save, 500);
				}
			});			
		},
		menuVisibility: function() {
			var hiddenOptions = ['history_menubar', 'context_menu', 'dramalinks', 'user_info_popup', 'embed_gfycat'];
			for (var i = 0, len = hiddenOptions.length; i < len; i++) {
				// add listener to each checkbox
				var element = document.getElementById(hiddenOptions[i]);
				element.addEventListener('change', options.ui.hideUnusedMenus);
			}
		}
	},
	ui: {
		hideUnusedMenus: function() {
			var hiddenOptions = {		
				'history_menubar': 'history_options', 
				'context_menu': 'context_options', 
				'dramalinks': 'dramalinks_options', 
				'user_info_popup': 'doubleclick_options',
				'embed_gfycat': 'gfycat_options'
			};
			
			for (var key in hiddenOptions) {
				var box = document.getElementById(key);
				var menu = document.getElementById(hiddenOptions[key]);		
				// only display hidden menus if checkbox is ticked
				box.checked ? menu.style.display = 'initial' : menu.style.display = 'none';
			}
		},
		closeMenu: function() {
			var menu = document.getElementById('menu_items');
			if (menu) {
				menu.remove();
			}			
		},		
		setColorPicker: function() {
			$('.color').ColorPicker({
				onChange : function(hsb, hex, rgb, el) {
					el.value = hex;
					options.save();
				},
				onSubmit : function(hsb, hex, rgb, el) {
					$(el).val(hex);
					$(el).ColorPickerHide();
					options.save();
				},
				livePreview : true,
				color : "",
				onBeforeShow : function() {
					$(this).ColorPickerSetColor(this.value);
				}
			});
		},
		
		populateCacheSize: function() {
			
			options.imageCache.open(function() {
			
				chrome.runtime.sendMessage({ need: 'getSizeInBytes' }, (bytes) => {
					// Convert bytes to MB and round to 2 decimal places							
					var megabytes = Math.round(bytes / 1048576 * 100) / 100;
					document.getElementById('cache_size').innerHTML =	megabytes;
				});
			
			});
				
		},
		
		populateCacheTable: function(sortedImages) {
			var table = document.getElementById('cache_contents');
			var loadingImage = document.getElementById('loading_img');
						
			if (sortedImages && sortedImages !== 'default') {	
			
				// Remove existing table rows
				options.ui.clearCacheTable();
				
				if (!sortedImages || sortedImages.length === 0) {					
					var empty = document.createElement('tr');
					empty.innerHTML = 'Empty';
					table.appendChild(empty);					
				}
				
				else {				
					// Create new table row for each result
					for (var i in sortedImages) {
						options.ui.createTableRow(sortedImages[i]);					
					}
				}
				
				// Display results and hide spinner
				loadingImage.style.display = "none";
				table.style.display = "block";
			}
			
			else {
				options.imageCache.open(() => {
					chrome.runtime.sendMessage({ need: 'getDbSize' }, (size) => {
						
						var table = document.getElementById('cache_contents');
						var loadingImage = document.getElementById('loading_img');
						var countElement = document.getElementById('cache_count');
						
						if (!size || size === 0) {
							// There was a problem loading database, or it was empty
							countElement.innerHTML = 0 + ' images';
							options.ui.clearCacheTable();
							
							var empty = document.createElement('tr');
							empty.innerHTML = 'Empty';
							table.appendChild(empty);
							
							loadingImage.style.display = "none";
							table.style.display = "block";							
							
							return;
						}
						
						else {
							if (size > 1) {
								countElement.innerHTML = size + ' images';
							} else {
								countElement.innerHTML = size + ' image';
							}
							
							if (sortedImages == 'default') {
								table.style.display = "none";
								loadingImage.style.display = "block";								
								options.ui.clearCacheTable();
							}
							
							options.ui.paginateImageCache(size);
							
							options.ui.displayPageFromCache(1);
							
							document.getElementById('pagination').addEventListener('click', (evt) => {
								
								if (evt.target.className === 'image_cache_page') {
									
									document.getElementsByClassName('selected')[0].classList.remove('selected');
									evt.target.classList.add('selected');
									options.ui.displayPageFromCache(evt.target.innerHTML);
								}
								
							});
							
							loadingImage.style.display = "none";
							table.style.display = "block";
						}
					});
				});
			}
		},
		
		displayPageFromCache: function(page) {
			options.ui.clearCacheTable();
			
			chrome.runtime.sendMessage({
			
					need: 'getPaginatedObjectStore',
					page: page,
					type: 'search'
					
			}, (images) => {
				
				for (var i = 0, len = images.length; i < len; i++) {
					var image = images[i];
					if (image) {
						options.ui.createTableRow(image);
					}
				}
				
			});
		},
		
		paginateImageCache: function(length) {
			var pages = Math.round(length / 50) + 1;
			var fragment = document.createDocumentFragment();
			for (var i = 0; i < pages; i++) {
				var page = document.createElement('span');
				page.innerHTML = i + 1;
				page.className = 'image_cache_page';
				fragment.appendChild(page);
			}			
			document.getElementById('pagination').appendChild(fragment);
			document.getElementsByClassName('image_cache_page')[0].classList.add('selected');
			document.getElementById('pagination').style.display = 'block';
			
		},
		
		createTableRow: function(result) {
			
			if (result) {
				var table = document.getElementById('cache_contents');		
				var tableRow = document.createElement('tr');			
				var filenameData = document.createElement('td');
				var urlData = document.createElement('td');
				
				var input = document.createElement('input');
				input.type = 'text';
				input.className = 'cache_filenames';
				input.value = result.filename;
				input.id = result.src;
				filenameData.appendChild(input);
				
				var original = document.createElement('span');
				original.className = 'cache_url_original';
				original.id = result.src;
				original.innerHTML = "View original";
				urlData.appendChild(original);	
				
				var space = document.createTextNode("  ");			
				urlData.appendChild(space);
										
				var thumbnail = document.createElement('span');
				thumbnail.className = 'cache_url_thumbnail';
				thumbnail.id = result.src;
				thumbnail.innerHTML = "View cached thumbnail";
				urlData.appendChild(thumbnail);				
				
				table.appendChild(tableRow);
				tableRow.appendChild(filenameData);
				tableRow.appendChild(urlData);
			}
			
			else {
				table.appendChild(document.createElement('tr'));
				tableRow.appendChild(document.createElement('td'));
				tableRow.appendChild(document.createElement('td'));				
			}
		},
		
		clearCacheTable: function() {
			var table = document.getElementById('cache_contents');							
			var nodes = table.childNodes;
			for (var i = nodes.length - 1, limit = 1; i > limit; i--) {
				var child = nodes[i];
				table.removeChild(child);
			}			
		},
		
		displayLBContent: function() {
			var config = JSON.parse(localStorage['ChromeLL-Config']);
			var likeData = config.custom_like_data;
			var textarea = document.getElementById('like_ta');
			var likeList = document.getElementById('like_list');
			var mostRecent = {
					'time': 0,
					'id': ''
			};
			for (var i in likeData) {
				var like = likeData[i];
				if (like.last_saved > mostRecent.time) {
					mostRecent.time = like.last_saved;
					mostRecent.id = i;
				}
				var anchor = document.createElement('a');
				var close = document.createElement('a');
				var linebreak = document.createElement('br');		
				anchor.href = '#';
				anchor.className = 'inactive_like';
				anchor.id = i;
				anchor.innerText = like.name;
				close.style.cssFloat = "right";
				close.style.fontSize = "18px";
				close.href = '#';
				close.style.textDecoration = "none";
				close.id = "delete_custom";
				close.innerHTML = '&#10006;';
				likeList.appendChild(anchor);
				anchor.appendChild(close);
				likeList.appendChild(linebreak);
			}
			
			document.getElementById(mostRecent.id).className = 'active_like';
			textarea.value = config.custom_like_data[mostRecent.id].contents;	
		},
		switchActive: function(id) {
			var config = JSON.parse(localStorage['ChromeLL-Config']);
			var type = id.replace(/[0-9]/g, '');
			var textarea = document.getElementById(type + '_ta');
			var data;
			
			if (type == 'like') {
				data = config.custom_like_data[id].contents;
				textarea.value = data;
			}

			else {
				return;
			}
		},
		addDiv: {
			userHighlight: function() {
				var ins = document.getElementById('user_highlight').getElementsByClassName(
						'user_name')[0].parentNode.parentNode.cloneNode(true);
				ins.className = "user_highlight_data";
				ins.style.display = "block";
				document.getElementById('user_highlight').insertBefore(ins, null);
				options.ui.setColorPicker();
			},
			bookmarkName: function() {
				var ins = document.getElementById('bookmarked_tags').getElementsByClassName(
						'bookmark_name')[0].parentNode.parentNode.cloneNode(true);
				ins.className = "bookmark_data";
				ins.style.display = "block";
				document.getElementById('bookmarked_tags').insertBefore(ins, null);		
			},
			snippetName: function() {
				var ins = document.getElementById('snippets').getElementsByClassName(
						'snippet_name')[0].parentNode.parentNode.cloneNode(true);
				ins.className = "snippet_data";
				ins.style.display = "block";
				document.getElementById('snippets').insertBefore(ins, null);		
			},
			keywordHighlight: function() {
				var ins = document.getElementById('keyword_highlight')
						.getElementsByClassName('keyword')[0].parentNode.parentNode
						.cloneNode(true);
				ins.className = "keyword_highlight_data";
				ins.style.display = "block";
				document.getElementById('keyword_highlight').insertBefore(ins, null);
				options.ui.setColorPicker();
			},
			tagHighlight: function() {
				var ins = document.getElementById('tag_highlight').getElementsByClassName(
						'tag')[0].parentNode.parentNode.cloneNode(true);
				ins.className = "tag_highlight_data";
				ins.style.display = "block";
				document.getElementById('tag_highlight').insertBefore(ins, null);
				options.ui.setColorPicker();	
			},
			postTemplate: function() {
				var ins = document.getElementById('post_template').getElementsByClassName(
						'template_text')[0].parentNode.parentNode.cloneNode(true);
				ins.className = "post_template_data";
				ins.style.display = "block";
				document.getElementById('post_template').insertBefore(ins, null);	
			}
		}
	},
	imageCache: {

		open: function(callback) {
			
			chrome.runtime.sendMessage({ need: 'openDatabase' }, callback);			
			
		},
		
		sort: function(sortType) {
		
			if (sortType === 'default') {
				options.ui.populateCacheTable(sortType);
			}
			
			else {
				var filenames = [];
				var results = [];
				var duplicateCheck = {};
				var filetypes = {};
				
				chrome.runtime.sendMessage({ need: 'getAllFromDb' }, function(images) {					
				
					if (sortType === 'filetype') {						
						filetypes["none"] = [];
						filetypes[".gif"] = [];
						filetypes[".jpg"] = [];
						filetypes[".png"] = [];
						
						// Iterate over images and push filenames to appropriate array
						for (var i in images) {
							var filename = images[i].filename;
							var extension = filename.match(/\.(gif|jpg|png)$/i);
							if (extension) {
								filetypes[extension[0]].push(filename);
							} else {		
								filetypes["none"].push(filename);
							}
						}
												
						for (var filetype in filetypes) {
							if (filetypes[filetype] === []) {
								return;
							}
							else {
								filenames = filenames.concat(filetypes[filetype]);
							}
						}
					}
					
					else {
						// Sort by filename
						for (var i in images) {
							var filename = images[i].filename;
							filenames.push(filename);
						}
						
						filenames.sort();
						
						if (sortType === 'z_a') {
							filenames.reverse();
						}
					}
					
					// Iterate over filenames array and match with their respective src values from cache
					for (var i = 0, len = filenames.length; i < len; i++) {
						var sortedFilename = filenames[i];
						
						for (var j in images) {
							var image = images[j];
							var cacheFilename = image.filename
							var src = image.src;
							
							if (cacheFilename == sortedFilename) {
								
								if (!duplicateCheck[src]) {
									// Check that src hasn't been pushed to results array before - this ensures that
									// duplicate filenames aren't assigned the same src value
									results.push(image);
									duplicateCheck[src] = { "filename": sortedFilename, "index": i };
								}
							}
						}
					}
					
					// Now we can populate database table using sorted array as a reference
					options.ui.populateCacheTable(results);
					
				});
			}
		},
		
		search: function() {
			var table = document.getElementById('cache_contents');
			var loadingImage = document.getElementById('loading_img');				
			var query = document.getElementById('imagemap_search').value;
			
			if (/\S/.test(query)) {
				table.style.display = "none";
				loadingImage.style.display = "block";				
				
				var request = {
						need: 'searchDatabase',
						query: query			
				};
				
				chrome.runtime.sendMessage(request, (results) => {
					options.ui.populateCacheTable(results);			
				});
			}
			
			else {
				options.ui.populateCacheTable('default');
			}
		}
	},
	getDefault: function(callback) {
		var defaultURL = chrome.extension.getURL('/src/json/defaultconfig.json');
		var temp, defaultConfig;
		var xhr = new XMLHttpRequest();
		xhr.open("GET", defaultURL, true);
		xhr.onreadystatechange = function() {
			if (xhr.readyState == 4 && xhr.status == 200) {
				temp = JSON.parse(xhr.responseText);
				defaultConfig = JSON.stringify(temp);
				callback(defaultConfig);
			}
		}
		xhr.send();	
	},
	save: function() {
		var config = JSON.parse(localStorage['ChromeLL-Config']);
			inputs = $(":checkbox");
			for (var i in inputs) {
				config[inputs[i].id] = inputs[i].checked;
			}
			var textboxes = $(":text");
			for (var i in textboxes) {
				var textbox = textboxes[i];
				if (textbox.className && textbox.className == ('cache_filenames')) {						
					// do nothing
				}
				else if (textbox.id && textbox.id.match(/imagemap_|script_/)) {						
					// do nothing
				}
				else {
					config[textbox.id] = textbox.value;
				}
			}
			var userhlData = document.getElementById('user_highlight')
					.getElementsByClassName('user_highlight_data');
			var name;
			config.user_highlight_data = {};
			for (var i = 0; userhlData[i]; i++) {
				name = userhlData[i].getElementsByClassName('user_name')[0].value
						.toLowerCase();
				if (name != '') {
					config.user_highlight_data[name] = {};
					config.user_highlight_data[name].bg = userhlData[i]
							.getElementsByClassName('header_bg')[0].value;
					userhlData[i].getElementsByClassName('user_name')[0].style.background = '#'
							+ config.user_highlight_data[name].bg;
					config.user_highlight_data[name].color = userhlData[i]
							.getElementsByClassName('header_color')[0].value;
					userhlData[i].getElementsByClassName('user_name')[0].style.color = '#'
							+ config.user_highlight_data[name].color;
				}
			}
			// get bookmark data from option page, save to config
			var userhlData = document.getElementById('bookmarked_tags')
					.getElementsByClassName('bookmark_data');
			config.bookmark_data = {};
			for (var i = 0; userhlData[i]; i++) {
				name = userhlData[i].getElementsByClassName('bookmark_name')[0].value;
				if (name != '') {
					config.bookmark_data[name] = userhlData[i]
							.getElementsByClassName('bookmark_tag')[0].value;
				}
			}
			// get snippet data from option page, save to config
			userhlData = document.getElementById('snippets')
					.getElementsByClassName('snippet_data');
			config.snippet_data = {};
			for (var i = 0; userhlData[i]; i++) {
				name = userhlData[i].getElementsByClassName('snippet_name')[0].value;
				name = name.trim();
				if (name != '') {
					config.snippet_data[name] = userhlData[i]
							.getElementsByClassName('snippet')[0].value;
				}
			}
			userhlData = document.getElementById('keyword_highlight')
					.getElementsByClassName('keyword_highlight_data');
			config.keyword_highlight_data = {};
			var j = 0;
			for (var i = 0; userhlData[i]; i++) {
				name = userhlData[i].getElementsByClassName('keyword')[0].value
						.toLowerCase();
				if (name != '') {
					config.keyword_highlight_data[j] = {};
					config.keyword_highlight_data[j].match = name;
					config.keyword_highlight_data[j].bg = userhlData[i]
							.getElementsByClassName('keyword_bg')[0].value;
					userhlData[i].getElementsByClassName('keyword')[0].style.background = '#'
							+ config.keyword_highlight_data[j].bg;
					config.keyword_highlight_data[j].color = userhlData[i]
							.getElementsByClassName('keyword_color')[0].value;
					userhlData[i].getElementsByClassName('keyword')[0].style.color = '#'
							+ config.keyword_highlight_data[j].color;
					j++;
				}
			}
			userhlData = document.getElementById('tag_highlight')
					.getElementsByClassName('tag_highlight_data');
			config.tag_highlight_data = {};
			var j = 0;
			for (var i = 0; userhlData[i]; i++) {
				name = userhlData[i].getElementsByClassName('tag')[0].value
						.toLowerCase();
				if (name != '') {
					config.tag_highlight_data[j] = {};
					config.tag_highlight_data[j].match = name;
					config.tag_highlight_data[j].bg = userhlData[i]
							.getElementsByClassName('tag_bg')[0].value;
					userhlData[i].getElementsByClassName('tag')[0].style.background = '#'
							+ config.tag_highlight_data[j].bg;
					config.tag_highlight_data[j].color = userhlData[i]
							.getElementsByClassName('tag_color')[0].value;
					userhlData[i].getElementsByClassName('tag')[0].style.color = '#'
							+ config.tag_highlight_data[j].color;
					j++;
				}
			}
			userhlData = document.getElementById('post_template')
					.getElementsByClassName('post_template_data');
			config.post_template_data = {};
			for (var i = 0; userhlData[i]; i++) {
				name = userhlData[i].getElementsByClassName('template_title')[0].value;
				if (name != '') {
					config.post_template_data[name] = {};
					config.post_template_data[name].text = userhlData[i]
							.getElementsByClassName('template_text')[0].value;
				}
			}
			config.clear_notify = document.getElementById('clear_notify').value;
			config.last_saved = new Date().getTime();
			localStorage['ChromeLL-Config'] = JSON.stringify(config);
	},
	restoreFromText: function(evt) {
		var file = evt.target.files[0];
		if (!file.type.match('text.*')) {
			alert("Not a text file...");
			return;
		}
		else {
			var reader = new FileReader();
			reader.onload = function(evt) {
				var textFile = evt.target.result;
				options.utils.processConfig(textFile);
			}
			reader.readAsText(file);
		}
	},
	restoreV1: function(oC) {
		var config = JSON.parse(localStorage['ChromeLL-Config']);
		var hls = oC.conf['chromeLL_userhighlight'].split(';');
		var hl = Array();
		config.user_highlight_data = {};
		for (var i = 0; hls[i]; i++) {
			hl = hls[i].split(':');
			console.log(hl[0]);
			config.user_highlight_data[hl[0]] = {};
			config.user_highlight_data[hl[0]].bg = hl[1];
			config.user_highlight_data[hl[0]].color = hl[3];
		}
		var boolSettings = {
			"force_https" : "chromeLL_forcehttps",
			"short_title" : "chromeLL_shorttitle",
			"float_userbar" : "chromeLL_floatbars",
			"ignorator" : "chromeLL_ignoretopicsbyon",
			"ignorator_list" : "chromeLL_ignoretopicsby",
			"enable_user_highlight" : "chromeLL_userhighlighton",
			"number_posts" : "chromeLL_numberposts",
			"enable_user_highlight" : "chromeLL_userhighlighton"
		}
		for ( var i in boolSettings) {
			if (oC.conf[i] == "true")
				config[i] = true;
		}
		config.ignorator_list = oC.conf['chromeLL_ignoretopicsby'];
		config.ignore_keyword_list = oC.conf['chromeLL_ignoretopics'];
		config.last_saved = new Date().getTime();
		console.log(config);
		localStorage['ChromeLL-Config'] = JSON.stringify(config);	
	},
	show: function() {
		document.getElementById('cfg_ta').value = localStorage['ChromeLL-Config'];
	},
	download: function(textfile) {
		options.save();
		var config = localStorage['ChromeLL-Config'];
		var data = new Blob([config], {type: 'text/plain'})
		var textfile = window.URL.createObjectURL(data);
		return textfile;	
	},
	debouncer: ''
};