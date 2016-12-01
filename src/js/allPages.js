var allPages = {
	config: {},
	cachedEvent: '',
	commonFunctions: {
		// Functions in this object are iterated over & executed on every page.
		error_check : function() {
			// NOTE - 502 errors also break message history, so there's no reason
			// to check for them. The only reason to check for errors is for cases
			// where the message history redirect would be useful.
			var bgImage = document.body.style.backgroundImage;
			if (bgImage.indexOf('errorlinks.png') > -1) {
				var dialog = document.createElement('dialog');
				var redirect = document.createElement('button');
				var close = document.createElement('button');
				var imageURL;
				document.body.style.overflow = "hidden";
				dialog.style.border = '1px solid rgba(0, 0, 0, 0.3)';
				dialog.style.borderRadius = '6px';
				dialog.style.boxShadow = '0 3px 7px rgba(0, 0, 0, 0.3)';
				imageURL = chrome.extension.getURL('/src/images/popup.png');
				dialog.style.backgroundImage = "url('" + imageURL + "')";
				dialog.style.backgroundColor = 'white';
				dialog.style.backgroundRepeat = 'no-repeat';
				dialog.style.backgroundPosition = 'center bottom';
				dialog.innerHTML = 'Error detected... redirect to history.php?' + '<br>'
						+ '(popup generated by ChromeLL)' + '<br>' + '<br>';
				redirect.innerText = 'Redirect'
				redirect.addEventListener('click', function() {
					if (window.location.protocol == 'https:') {
						window.location.href = 'https://boards.endoftheinter.net/history.php?b';
					} else {
						window.location.href = 'http://boards.endoftheinter.net/history.php?b';
					}
				});
				close.innerText = 'Close';
				close.addEventListener('click', function() {
					dialog.close();
				});
				dialog.appendChild(redirect);
				dialog.appendChild(close);
				document.body.appendChild(dialog);
				dialog.showModal();
				return;
			}
		},
		notify_pm : function() {
			var userbar_pms = document.getElementById('userbar_pms');
			if (!userbar_pms) {
				return;
			}
						
			var observer = new MutationObserver(function() {
				
				// If there was a mutation to userbar_pms element, we can be sure that user received a new PM
				
				if (userbar_pms.style.display == 'none' && allPages.config.pms != 0) {
					// clear unread message count from config
					allPages.config.pms = 0;
					chrome.runtime.sendMessage({
							need : "save",
							name : "pms",
							data : allPages.config.pms
					});
				}
				else if (userbar_pms.style.display != 'none') {
					var pms_text = userbar_pms.innerText;
					var pm_number = parseInt(pms_text.match(/\((\d+)\)/)[1]);
					var notify_title, notify_msg;
					// compare pm_number to last known value for pm_number
					if (pm_number > allPages.config.pms) {
						// you have mail
						if (pm_number == 1) {
							notify_title = 'New PM';
							notify_msg = 'You have 1 unread private message.';
						}
						else {
							notify_title = 'New PMs';
							notify_msg = 'You have ' + pm_number
									+ ' unread private messages.';
						}
						
						// notify user and save current pm_number
						chrome.runtime.sendMessage({
								need: "notify",
								title: notify_title,
								message: notify_msg
						}, null);
						
						allPages.config.pms = pm_number;
						
						chrome.runtime.sendMessage({
								need : "save",
								name : "pms",
								data : allPages.config.pms
						});
					}
					else {
						// user has unread PMs, but no new PMs
						return;
					}
				}
			});
			
			observer.observe(userbar_pms, {
					attributes: true,
					childList: true
			});
		},
		history_menubar : function() {
			var link = document.createElement('a');
			link.innerHTML = 'Message History';
			if (allPages.config.history_menubar_classic)
				link.href = '//boards.endoftheinter.net/history.php';
			else
				link.href = '//boards.endoftheinter.net/topics/Posted';
			if (document.body.className === 'regular') {
				var sep = document.createElement('span');
				var menubar = document.getElementsByClassName('menubar')[0];
				sep.innerHTML = ' | ';
				menubar.insertBefore(link, menubar.getElementsByTagName('br')[0]);
				menubar.insertBefore(sep, link);
			} else if (document.body.className === 'classic') {
				var br = document.createElement('br');
				document.getElementsByClassName('classic3')[0].insertBefore(link,
						null);
				document.getElementsByClassName('classic3')[0].insertBefore(br,
						link);
			}
		},
		float_userbar : function() {
			var id = document.createElement('div');
			var userbar = document.getElementsByClassName('userbar')[0];
			var menubar = document.getElementsByClassName('menubar')[0];
			document.getElementsByClassName('body')[0].removeChild(userbar);
			document.getElementsByClassName('body')[0].removeChild(menubar);
			id.insertBefore(menubar, null);
			id.insertBefore(userbar, null);
			id.style.position = 'fixed';
			id.style.width = '100%';
			id.style.top = '0';
			userbar.style.marginTop = '-2px';
			userbar.style.borderBottomLeftRadius = '5px';
			userbar.style.borderBottomRightRadius = '5px';
			allPages.config.remove_links ? document.getElementsByTagName('h1')[0].style.paddingTop = '20px'
					: document.getElementsByTagName('h1')[0].style.paddingTop = '40px';
			document.getElementsByClassName('body')[0].insertBefore(id, null);
		},
		float_userbar_bottom : function() {
			var menubar = document.getElementsByClassName('menubar')[0];
			var userbar = document.getElementsByClassName('userbar')[0];
			menubar.style.position = "fixed";
			menubar.style.width = "99%";
			menubar.style.bottom = "-2px";
			userbar.style.position = "fixed";
			userbar.style.borderTopLeftRadius = '5px';
			userbar.style.borderTopRightRadius = '5px';
			userbar.style.width = "99%";
			userbar.style.bottom = "33px";
			menubar.style.marginRight = "20px";
			menubar.style.zIndex = '2';
			userbar.style.zIndex = '2';
		},
		short_title : function() {
			document.title = document.title.replace(/End of the Internet - /i, '');
		},
		user_info_popup : function() {	
			if (window.location.href.indexOf('//endoftheinter.net/profile.php?') > -1) {
				return;
			}
			
			// Create placeholder popup that we can populate later.
			var links = ["PM", "GT", "BT", "HIGHLIGHT", "UNHIGHLIGHT", "IGNORATE"];					
			var popupElement = document.createElement('div');			
			popupElement.className = 'user_info_popup';
			popupElement.id = 'user-popup-div';
			var info = document.createElement('div');
			info.className = 'user_info_popup';
			info.id = 'popup_info';
			var user = document.createElement('div');
			user.className = 'user_info_popup';
			user.id = 'popup_user';

			for (var i = 0, len = links.length; i < len; i++) {
				var span = document.createElement('span');
				span.className = 'popup_link';
				span.innerHTML = links[i];
				span.addEventListener('click', allPages.popup.clickHandler);
				info.appendChild(span);
			}
			
			popupElement.appendChild(user);
			popupElement.appendChild(info);
			document.body.appendChild(popupElement);				
			
			document.addEventListener('click', function(evt) {
				if (evt.target.className != 'popup_link') {
					allPages.popup.hide();
				}
			});
		}
	},
	popup: {
		// Creates popup containing scraped info from user profile.
		handler: function() {
			// Use cached event as this method is called from setTimeout
			var evt = allPages.cachedEvent;
			var usernameAnchor = evt.target;
			var boundingRect = usernameAnchor.getBoundingClientRect();
			var x = (boundingRect.left + (boundingRect.width / 2)) - document.body.scrollLeft + usernameAnchor.clientLeft;
			var y = boundingRect.top + document.body.scrollTop + usernameAnchor.clientTop;
			var profileURL = usernameAnchor.href;
			this.username = usernameAnchor.innerHTML;
			this.currentPost = usernameAnchor.parentNode;
			this.userId = profileURL.match(/user=(\d+)/)[1];
			var gs = this.checkAccountAge(this.userId);
			
			var xhr = new XMLHttpRequest();
			xhr.open("GET", profileURL, true);
			xhr.onload = function() {
				if (this.status == 200) {
					allPages.popup.scrapeProfile(this.responseText);
				}
			};		
			xhr.send();
			
			var popup = document.getElementById('popup_user');

			popup.innerHTML = '<div id="username" class="user_info_popup">' + this.username + " " + gs 
					+ ' <span id="popup_uid" class="user_info_popup">' + this.userId + '</span></div>'					
					+ '<div id="namechange" class="user_info_popup"></div>'					
					+ '<div id="rep" class="user_info_popup"><span id="popup_loading" class="user_info_popup">loading...</span></div>'
					+ '<div id="online" class="user_info_popup"></div>' 
					+ '<div id="punish" class="user_info_popup"></div>';
					
			var popupContainer = document.getElementById('user-popup-div');
			// Modify coordinates so that arrow in popup points to selected username element
			popupContainer.style.left = (x - 35) + "px";
			popupContainer.style.top = (y + 25) + "px";
			popupContainer.style.display = 'block';
			// Add mousemove listener to detect when popup should be closed		
			document.addEventListener('mousemove', this.mousemoveHandler);			
		},
		
		scrapeProfile: function(responseText) {
			var html = document.createElement('html');
			html.innerHTML = responseText;
			var tds = html.getElementsByTagName('td');
			// var status, aliases, rep;
			for (var i = 0, len = tds.length; i < len; i++) {
				var td = tds[i];
				if (td.innerText.indexOf('Status') > -1) {
					var status = tds[i + 1].innerText;
				}
				if (td.innerText.indexOf('Formerly') > -1) {
					var aliases = tds[i + 1].innerText;
				}
				if (td.innerText.indexOf('Reputation') > -1) {
					var rep = tds[i + 1].innerHTML;
				}
			}
			this.update(html, status, aliases, rep);
		},
		
		update: function(html, status, aliases, rep) {
			var placeholderElement = document.getElementById("popup_loading");			
			var aliasesElement = document.getElementById("namechange");
			var onlineElement = document.getElementById('online');
			var statusElement = document.getElementById('punish');
			var repElement = document.getElementById('rep');
			placeholderElement.style.display = 'none';
			repElement.innerHTML = rep;	
			if (allPages.config.show_old_name) {
				if (aliases) {
					aliasesElement.innerHTML = "<br>Formerly known as: <b>" + aliases + '</b>';
				}
			}	
			if (html.innerHTML.indexOf('(online now)') > -1) {
					onlineElement.innerHTML = '(online now)';
			}	
			if (status) {
				if (status.indexOf('Suspended') > -1) {
						statusElement.innerHTML = '<b>Suspended until: </b>' + status.substring(17);
				}
				if (status.indexOf('Banned') > -1) {
						statusElement.innerHTML = '<b>Banned</b>';
				}
			}		
		},
		
		checkAccountAge: function(userID) {
			// Returns appropriate "GS" value for account age. Otherwise, returns empty string
			if (!allPages.config.hide_gs) {
				switch (userID) {
					case (userID > 22682):
							return ' (gs)\u2076';
					case (userID > 21289):
							return ' (gs)\u2075';
					case (userID > 20176):
							return ' (gs)\u2074';
					case (userID > 15258):
							return ' (gs)\u00B3';
					case (userID > 13498):
							return ' (gs)\u00B2';
					case (userID > 10088):
							return ' (gs)';
					default:
							return '';
				}
			}
			else {				
				return '';
			}
		},
		
		hide: function() {
			document.getElementById('user-popup-div').style.display = 'none';
			document.removeEventListener('mousemove', allPages.popup.mousemoveHandler);
		},
		
		mousemoveHandler: function(evt) {			
			// Close popup if user moves mouse outside of popup (triggered after 250ms delay)
			if (!allPages.popup.popupBoundaryCheck(evt.target)) {
				if (!allPages.popup.waiting) {
					allPages.popup.debouncerId = setTimeout(allPages.popup.hide, 250);
					allPages.popup.waiting = true;
				}
			}
			else {
				clearTimeout(allPages.popup.debouncerId);
				allPages.popup.waiting = false;
			}
		},
		
		popupBoundaryCheck: function(target) {
			switch (target.className) {
				case 'user_info_popup':
				case 'username_anchor':
				case 'popup_link':
				case 'popup_user':
				case 'rep_anchor':
					return true;

				default:
					return false;
			}
		},
		
		clickHandler: function(evt) {
				var user = allPages.popup.username.toLowerCase();
				
				if (window.messageList) {
					var containers = document.getElementsByClassName('message-container');
					var container;
					var functions = messageList.functions.messagecontainer;
				}
				
				else if (window.topicList) {	
					var trs = document.getElementsByTagName('tr');
					var tr;
					var functions = topicList.functions;
				}
				
				var target = allPages.popup.currentPost;
				var type = evt.target.innerHTML;
				
				switch (type) {			
					case "IGNORATE?":
						if (!allPages.config.ignorator_list || allPages.config.ignorator_list == '') {
							allPages.config.ignorator_list = allPages.popup.username;
						} else {
							allPages.ignorator_list += ", " + allPages.popup.username;
						}
						chrome.runtime.sendMessage({
							need : "save",
							name : "ignorator_list",
							data : allPages.config.ignorator_list
						});
						if (window.messageList) {
							messageList.config.ignorator_list = allPages.config.ignorator_list;
							for (var i = 0, len = containers.length; i < len; i++) {
								container = containers[i];
								functions.ignorator_messagelist(container);
							}
						}
						else {
							topicList.config.ignorator_list = allPages.config.ignorator_list;
							topicList.createArrays();
							for (var i = 1, len = trs.length; i < len; i++) {
								tr = trs[i];
								functions.ignorator_topiclist(tr, i);
							}
						}
						evt.target.innerHTML = "IGNORATE";
						allPages.popup.hide();
						break;
						
					case "IGNORATE":
						evt.target.innerHTML = "IGNORATE?";
						break;
						
					case "PM":
						chrome.runtime.sendMessage({
							need : "opentab",
							url : "http://endoftheinter.net/postmsg.php?puser=" + allPages.popup.userId
						});
						allPages.popup.hide();
						break;
						
					case "GT":
						chrome.runtime.sendMessage({
							need : "opentab",
							url : "http://endoftheinter.net/token.php?type=2&user=" + allPages.popup.userId
						});
						allPages.popup.hide();
						break;
						
					case "BT":
						chrome.runtime.sendMessage({
							need : "opentab",
							url : "http://endoftheinter.net/token.php?type=1&user=" + allPages.popup.userId
						});
						allPages.popup.hide();
						break;
						
					case "HIGHLIGHT":
						allPages.config.user_highlight_data[user] = {};
						allPages.config.user_highlight_data[user].bg = Math.floor(
								Math.random() * 16777215).toString(16);
						allPages.config.user_highlight_data[user].color = Math.floor(
								Math.random() * 16777215).toString(16);
						chrome.runtime.sendMessage({
							need : "save",
							name : "user_highlight_data",
							data : allPages.config.user_highlight_data
						});
						if (window.messageList) {
							// update config object in messageList script
							messageList.config.user_highlight_data = allPages.config.user_highlight_data;
							var top;
							for (var i = 0, len = containers.length; i < len; i++) {
								container = containers[i];
								functions.userhl_messagelist(container, i);
								if (allPages.config.foxlinks_quotes) {
									 functions.foxlinks_quote(container);
								}
							}
						} else {
							// update config object in topicList script
							topicList.config.user_highlight_data = allPages.config.user_highlight_data;
							for (var i = 1, len = trs.length; i < len; i++) {
								tr = trs[i];
								functions.userhl_topiclist(tr);
							}
						}				
						break;
						
					case "UNHIGHLIGHT":
						delete allPages.config.user_highlight_data[allPages.popup.username
								.toLowerCase()];
						chrome.runtime.sendMessage({
							need : "save",
							name : "user_highlight_data",
							data : allPages.config.user_highlight_data
						});
						if (window.messageList) {
							// update config object in messageList scripts
							messageList.config.user_highlight_data = allPages.config.user_highlight_data;
							var message_tops = document.getElementsByClassName('message-top');
							for (var i = 0, len = message_tops.length; i < len; i++) {
								var top = message_tops[i];
								if (top.getElementsByTagName('a')[0]) {
									var userToCheck = top.getElementsByTagName('a')[0].innerHTML;
									if (userToCheck === allPages.popup.username) {		
										top.style.background = '';
										top.style.color = '';
										var top_atags = top.getElementsByTagName('a');
										for ( var j = 0; j < top_atags.length; j++) {
											top_atags[j].style.color = '';
										}
									}
								}
							}
						} else {
							// update config object in topicList scripts
							topicList.config.user_highlight_data = allPages.config.user_highlight_data;
							var tds, td, tags;
							for (var i = 1, len = trs.length; i < len; i++) {
								tr = trs[i];
								tds = tr.getElementsByTagName('td');
								if (tds[1].getElementsByTagName('a')[0]) {
									var userToCheck = tds[1].getElementsByTagName('a')[0].innerHTML;
									if (userToCheck === allPages.popup.username) {
										for (var j = 0, tds_len = tds.length; j < tds_len; j++) {
											td = tds[j];
											td.style.background = '';
											td.style.color = '';
											tags = td.getElementsByTagName('a');
											for (var k = 0, tags_len = tags.length; k < tags_len; k++) {
												tags[k].style.color = '';
											}
										}
									}
								}
							}
						}
						allPages.popup.hide();
						break;
				}
		}
	},
	optionsMenu: {
		show: function() {
			var url = chrome.extension.getURL('options.html');
			var div = document.createElement('div');
			var iframe = document.createElement('iframe');
			var width = window.innerWidth;
			var height = window.innerHeight;
			var close = document.createElement('div');
			var anchorHeight;
			
			div.id = "options_div";
			div.style.width = (width * 0.95) + 'px';
			div.style.height = (height * 0.95) + 'px';
			div.style.left = (width - (width * 0.975)) + 'px';
			div.style.top = (height - (height * 0.975)) + 'px';
			
			close.id = "close_options";

			iframe.style.width = "inherit";
			iframe.src = url;
			iframe.style.backgroundColor = "white";
			iframe.style.border = "none";
			
			document.getElementsByClassName('body')[0].style.opacity = 0.3;
			
			div.appendChild(close);
			div.appendChild(iframe);
			document.body.appendChild(div);
			
			anchorHeight = close.getBoundingClientRect().height * 2;
			iframe.style.height = ((height * 0.95) - anchorHeight) + 'px';
			
			this.addListeners();						
		},
		addListeners: function() {
			const ESCAPE_KEY = 27;
			
			document.getElementsByClassName('body')[0].addEventListener('click', this.hide);
			document.getElementById('close_options').addEventListener('click', this.hide);
			
			document.body.addEventListener('keyup', (evt) => {
				if (evt.keyCode === ESCAPE_KEY) {
					this.hide();
				}			
			});
			
			document.body.addEventListener('mousewheel', this.preventScroll);
		},
		hide: function() {			
			var div = document.getElementById('options_div');
			var bodyClass = document.getElementsByClassName('body')[0];
			bodyClass.style.opacity = 1;
			document.body.removeChild(div);
			bodyClass.removeEventListener('click', allPages.optionsMenu.hide);
			document.body.removeEventListener('click', allPages.optionsMenu.hide);			
			document.body.removeEventListener('mousewheel', allPages.optionsMenu.preventScroll);
		},
		preventScroll: function(event) {
			event.preventDefault();
		}
	},
	asyncUpload : function(tgt, i) {
		if (!i) {
			var i = 0;
		}
		var xh = new XMLHttpRequest();
		xh.onreadystatechange = function() {
			if (this.readyState === 4 && this.status === 200) {
				var tmp = document.createElement('div');
				tmp.innerHTML = this.responseText;
				var update_ul;
				if (window.location.href.match('postmsg')) {
					update_ul = document.getElementsByTagName('form')[0]
							.getElementsByTagName('b')[2];
				} else {
					update_ul = document
							.getElementsByClassName('quickpost-body')[0]
							.getElementsByTagName('b')[0];
				}
				var current = update_ul.innerHTML
						.match(/Uploading: (\d+)\/(\d+)\)/);
				var tmp_input = tmp.getElementsByClassName('img')[0]
						.getElementsByTagName('input')[0];
				if (tmp_input.value) {
					if (tmp_input.value.substring(0, 4) == '<img') {
						allPages.quickReplyInsert(tmp_input.value);
						if ((i + 1) == current[2]) {
							update_ul.innerHTML = "Your Message";
						} else {
							update_ul.innerHTML = "Your Message (Uploading: "
									+ (i + 2) + "/" + current[2] + ")";
						}
					}
				}
				i++;
				if (i < tgt.length) {
					allPages.asyncUpload(tgt, i);
				}
			}
		};
		var http = 'https';
		if (window.location.href.indexOf('https:') == -1)
			http = 'http';
		xh.open('post', http + '://u.endoftheinter.net/u.php', true);
		var formData = new FormData();
		formData.append('file', tgt[i]);
		xh.withCredentials = "true";
		xh.send(formData);
	},
	quickReplyInsert : function(text) {
		var quickreply = document.getElementsByTagName('textarea')[0];
		var qrtext = quickreply.value;
		var oldtxt = qrtext.split('---');
		var newtxt = '';
		for ( var i = 0; i < oldtxt.length - 1; i++) {
			newtxt += oldtxt[i];
		}
		newtxt += text + "\n---" + oldtxt[oldtxt.length - 1];
		quickreply.value = newtxt;
	},
	init: function(config) {
		this.config = config;
		
		try {
			for (var i in this.commonFunctions) {
				if (config[i]) {
					this.commonFunctions[i]();
				}
			}
		} catch (err) {
			console.log("error in " + i + ":", err);
		}
		
		chrome.runtime.sendMessage({
			need: "insertcss",
			file: "src/css/allpages.css"
		});
		
		if (window.location.pathname !== "/main.php") {
			addPopupCSS();
		}
		
		chrome.runtime.onMessage.addListener(function(msg) {
			if (msg.action == 'showOptions') {
				allPages.optionsMenu.show();
			}
		});
	}
};

chrome.runtime.sendMessage({
	need: "config"
}, function(response) {
	allPages.init.call(allPages, response.data);
});

var getCustomColors = function() {	
	// (first 'h1' element is either tag name (in topic list), or topic title (in message list)
	var titleText = document.getElementsByTagName('h1')[0];
	var anchor = document.getElementsByTagName('a')[0];
	var userbar = document.getElementsByClassName('userbar')[0];
	var infobar = document.getElementsByClassName('infobar')[0];
	var message = document.getElementsByClassName('message')[0] || document.getElementsByTagName('th')[0];			

	var customColors = {};
	customColors.text = window.getComputedStyle(titleText).getPropertyValue('color');			
	customColors.anchor = window.getComputedStyle(anchor).getPropertyValue('color');				
	customColors.body = window.getComputedStyle(document.body).getPropertyValue('background-color');
	customColors.message = window.getComputedStyle(message).getPropertyValue('background-color');
	customColors.userbar = window.getComputedStyle(userbar).getPropertyValue('background-color');
	customColors.infobar = window.getComputedStyle(infobar).getPropertyValue('background-color');
	
	// Kludgy fix to improve visiblity of user info popup if user is using custom CSS with rgba values.
	// Browser seems to just ignore the alpha parameter if we change rgba to rgb
	
	for (var color in customColors) {	
		if (customColors[color].indexOf('rgba') > -1) {
			customColors[color] = customColors[color].replace('rgba', 'rgb');
		}
	}
	
	return customColors;
};

var addPopupCSS = function() {
	var styleSheet = document.styleSheets[0];
	var customColors = getCustomColors();
	// Dynamically create rules for user info popup using ETI colour scheme (to make sure that content is readable)
	styleSheet.addRule('#user-popup-div',  'color: ' + customColors.text);			
	styleSheet.addRule('#user-popup-div',  'background: ' + customColors.message);
	styleSheet.addRule('#user-popup-div',  'border-color: ' + customColors.body);		
	styleSheet.addRule('.popup_link', 'color: ' + customColors.anchor);
	styleSheet.addRule('.popup_link', 'background: ' + customColors.userbar);
	styleSheet.addRule('#username, #popup_uid, #namechange, #online, #punish, #popup_loading, #rep, #rep a', 'color: ' + customColors.text);
	// #user-popup-div:before should be same colour as #user-popup-div background
	styleSheet.addRule('#user-popup-div:before', 'border-bottom-color: ' + customColors.body);	
	// #user-popup-div:after should be same colour as #user-popup-div border
	styleSheet.addRule('#user-popup-div:after', 'border-bottom-color: ' +   customColors.infobar);
};
