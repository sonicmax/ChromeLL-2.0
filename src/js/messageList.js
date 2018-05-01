var messageList = {
	config: [],
	ignoredUsers: [],
	autoscrolling: false,
	imagemapDebouncer: '',
	menuDebouncer: '',
	zoomLevel: 1,
	ignorated: {
		total_ignored: 0,
		data: {
			users: {}
		}
	},
	topicCreator: '',
	pm: '',
	tags: [],
	
	
	/**
	 *  Do some initialisation before DOMContentLoaded fires.
	 */
	
	init: function(config) {
		this.config = config.data;

		if (!config.tcs) {
			this.config.tcs = {};
		}
		
		else {
			this.config.tcs = config.tcs
		}
		
		this.prepareIgnoratorArray();
		
		// set up globalPort so we can interact with background page
		this.globalPort = chrome.runtime.connect();
		this.globalPort.onMessage.addListener(this.handleEvent.onReceiveMessage);
		
		if (this.config.reload_on_update) {
			this.globalPort.onDisconnect.addListener(this.handleEvent.onPortDisconnect);
		}
		
		if (window.location.pathname === '/inboxthread.php') {
			this.pm = "_pm";
		}
		
		// check whether we need to display dramalinks ticker
		if (this.config.dramalinks && !this.pm) {
			
			this.sendMessage({ need: "dramalinks" }, (response) => {
				dramalinks.html = response.data;					
				dramalinks.config = messageList.config;				
			});
		}
		
		this.getZoomLevel();
		
		if (window.location.search.indexOf('thread=') > -1) {
			this.handleRepliesPage();			
		}
		
		if (this.config.use_custom_serious_color) {
			this.addCustomSeriousStyle();
		}		
		
		// Replace with empty function to prevent seasonal CSS from being added.
		if (!this.config.seasonal_css || new Date().getMonth() !== 11) {
			this.addChristmasCss = () => {};
		}
		
		if (document.readyState == 'loading') {
			// wait for DOMContentLoaded to fire before attempting to modify DOM
			document.addEventListener('DOMContentLoaded', () => {
				messageList.applyDomModifications.call(messageList, messageList.pm);
			});
		}
		else {
			this.applyDomModifications.call(this, this.pm);
		}
	},
	
	messageContainerMethods: {
		ignorator_messagelist: function(msg) {
			if (!messageList.config.ignorator) {
				// User enabled ignorator, but didn't populate list with usernames
				return;
			}
			
			var tops = msg.getElementsByClassName('message-top');
				
			// Note: don't cache length property, it will break
			for (var j = 0; j < tops.length; j++) {
				var top = tops[j];
								
				var username = top.getElementsByTagName('a')[0].innerHTML.toLowerCase();
				
				for (var f = 0, len = messageList.ignoredUsers.length; f < len; f++) {
					var ignoredUser = messageList.ignoredUsers[f];
					
					if (username == ignoredUser.toLowerCase()) {
						
						top.parentNode.classList.add('ignorated');
						
						messageList.ignorated.total_ignored++;
						
						// Keep track of any users that have been ignored (and the number of posts they made)
						if (!messageList.ignorated.data.users[ignoredUser]) {
							messageList.ignorated.data.users[ignoredUser] = {};
							messageList.ignorated.data.users[ignoredUser].total = 1;
						} 
						
						else {
							messageList.ignorated.data.users[ignoredUser].total++;
						}
						
						if (!messageList.config.hide_ignorator_badge) {
							messageList.globalPort.postMessage({
								action: 'ignorator_update',
								ignorator: messageList.ignorated,
								scope: "messageList"
							});
						}
					}
				}
			}
		},
		
		user_notes: function(msg, top) {
			// Unlikely, but still possible that usernote_notes hasn't been populated
			if (!messageList.config.usernote_notes) {
				messageList.config.usernote_notes = {};
			}	
							
			// Anon topic - ignore
			if (messageList.tags.includes('Anonymous')) {
				return;
			}
			
			var notebook = document.createElement('a');	
			notebook.id = 'notebook';
			
			var userId = top.getElementsByTagName('a')[0].href.match(/user=(\d+)$/i)[1];
			
			notebook.innerHTML = (messageList.config.usernote_notes[userId] != undefined 
					&& messageList.config.usernote_notes[userId] != '')
							? 'Notes*' : 'Notes';
							
			notebook.href = "##note" + userId;
			
							
			top.appendChild(document.createTextNode(' | '));
			top.appendChild(notebook);
		},
		
		like_button: function(msg, top, index) {
			var anchor = document.createElement('a');
			var divider = document.createTextNode(" | ");
			anchor.innerHTML = 'Like';
			anchor.className = 'like_button';
			anchor.href = '##like';
			top.appendChild(divider);
			top.appendChild(anchor);
			anchor.addEventListener('mouseenter', messageList.handleEvent.mouseenter.bind(messageList));
			anchor.addEventListener('mouseleave', messageList.handleEvent.mouseleave.bind(messageList));				
		},
		
		number_posts: function(msg, top, index) {
			var page;
			
			if (!window.location.href.match(/page=/)) {
				page = 1;
			}
			
			else {
				page = window.location.href.match(/page=(\d+)/)[1];
			}
			
			var id = (index + (50 * (page - 1)));
			
			// Pad id with zeros so we always have a 4 digit number (0001, 0010, etc)
			if (id < 1000)
				id = "0" + id;
			if (id < 100)
				id = "0" + id;
			if (id < 10)
				id = "0" + id;
			
			var postNumber = document.createTextNode(' | #' + id);
			top.appendChild(postNumber);
		},
		
		post_templates: function(msg, top, index) {
			var cDiv = document.createElement('div');
			cDiv.style.display = 'none';
			cDiv.id = 'cdiv';
			document.body.appendChild(cDiv, null);
			messageList.postEvent = document.createEvent('Event');
			messageList.postEvent.initEvent('postTemplateInsert', true, true);
			var sep = document.createElement('span');
			sep.innerHTML = " | ";
			sep.className = "post_template_holder";
			var sepIns = document.createElement('span');
			sepIns.className = 'post_template_opts';
			sepIns.innerHTML = '[';
			var qr = document.createElement('a');
			qr.href = "##" + index;
			qr.innerHTML = "&gt;"
			qr.className = "expand_post_template";
			sepIns.appendChild(qr);
			sepIns.innerHTML += ']';
			sep.appendChild(sepIns);
			top.appendChild(sep);
		},
		
		userhl_messagelist: function(msg, firstTop, index, live) {
			if (!messageList.config.enable_user_highlight) {
				return;
			}
			
			var tops = msg.getElementsByClassName('message-top');
			
			if (!messageList.config.no_user_highlight_quotes) {
				
				// Note: don't cache length property, it will break
				for (var k = 0; k < tops.length; k++) {
					var top = tops[k];			
					var user = top.getElementsByTagName('a')[0].innerHTML.toLowerCase();
					
					if (messageList.config.user_highlight_data[user]) {
						
						top.setAttribute('highlighted', true);								
						top.style.background = '#' + messageList.config.user_highlight_data[user].bg;
						top.style.color = '#' + messageList.config.user_highlight_data[user].color;
								
						var anchors = top.getElementsByTagName('a');
						
						for (var j = 0, len = anchors.length; j < len; j++) {
							var anchor = anchors[j];
							anchor.style.color = '#' + messageList.config.user_highlight_data[user].color;
						}
						
						if (live && messageList.config.notify_userhl_post && k === 0
								&& top.getElementsByTagName('a')[0].href.match(/user=(\d+)$/i)[1] != messageList.config.user_id) {
							
							messageList.sendMessage({
								need: "notify",
								title: "Post by " + top.getElementsByTagName('a')[0].innerHTML,
								message: document.title.replace(/End of the Internet - /i, '')									
							});
							
						}					
					}
				}				
			}
			
			else {
				user = firstTop.getElementsByTagName('a')[0].innerHTML.toLowerCase();
						
				if (messageList.config.user_highlight_data[user]) {
					
					firstTop.style.background = '#'
							+ messageList.config.user_highlight_data[user].bg;
					firstTop.style.color = '#'
							+ messageList.config.user_highlight_data[user].color;
							
					anchors = firstTop.getElementsByTagName('a');
					
					for (var j = 0, len = anchors.length; j < len; j++) {
						anchor = anchors[j];
						anchor.style.color = '#'
								+ messageList.config.user_highlight_data[user].color;
					}
					
					if (live && messageList.config.notify_userhl_post
							&& top.getElementsByTagName('a')[0].href.match(/user=(\d+)$/i)[0] != messageList.config.user_id) {
						
						messageList.sendMessage({
							need: "notify",
							title: "Post by " + user,
							message: document.title.replace(/End of the Internet - /i, '')
						});
					}				
				}
			}
		},
		
		foxlinks_quotes: function(msg) {			
			var quotes = msg.getElementsByClassName('quoted-message');
			
			if (!quotes) {
				return;
			}
			
			var color = "#" + messageList.config['foxlinks_quotes_color'];

			for (var i = 0, len = quotes.length; i < len; i++) {
				var quote = quotes[i];
				quote.style.borderStyle = 'solid';
				quote.style.borderWidth = '2px';
				quote.style.borderRadius = '5px';
				quote.style.marginRight = '30px';
				quote.style.marginLeft = '10px';
				quote.style.paddingBottom = '10px';
				quote.style.marginTop = '0px';
				quote.style.borderColor = color;
				
				var top = quote.getElementsByClassName('message-top')[0];
				
				if (top) {
					if (top.style.background == '') {
						top.style.background = color;
					} else {
						quote.style.borderColor = top.style.background;
					}
					top.style.marginTop = '0px';
					top.style.paddingBottom = '2px';
					top.style.marginLeft = '-6px';
				}
			}
		},
		
		label_self_anon: function(msg) {
			if (messageList.tags.includes('Anonymous')) {
				// We can only get human number from topics that we can post in
				var quickpostBody = document.getElementsByClassName('quickpost-body')[0];
				
				if (quickpostBody) {					
					var tops = msg.getElementsByClassName('message-top');
					var userRegex = /user=(\d+)$/;
					
					if (!userRegex.test(tops[0].getElementsByTagName('a')[0])) {	
						var self = quickpostBody.getElementsByTagName('a')[0].innerHTML;
						
						if (self.indexOf('Human #') == -1) {
							// User hasn't posted in topic yet
							return;
						}
						
						else {
							for (var i = 0, len = tops.length; i < len; i++) {
								var top = tops[i];
								var element = top.getElementsByTagName('a')[0];
								
								if (element.innerHTML.indexOf('Filter') > -1) {
									element = top.getElementsByTagName('b')[0].nextSibling;	
									// trim nodeValue so that we can check for equality with self variable
									var humanToCheck = element.nodeValue.substring(1, element.nodeValue.length);
									humanToCheck = humanToCheck.replace(' | ', '');
									if (humanToCheck == self) {											
										var span = document.createElement('span');
										span.innerHTML = '<b>(Me)</b> | ';
										top.insertBefore(span, element.nextSibling);		
									}
								}
								
								else if (element.innerHTML == self) {
										var span = document.createElement('span');
										span.innerHTML = ' | <b>(Me)</b>';
										top.insertBefore(span, element.nextSibling);
								}
							}
						}
					}
				}
			}
		},
		
		highlight_tc: function(msg) {
			var tops = msg.getElementsByClassName('message-top');
			
			for (var i = 0, len = tops.length; i < len; i++) {
				var top = tops[i];
				var usernameElement = top.getElementsByTagName('a')[0];
				
				if (usernameElement.innerHTML.toLowerCase() == messageList.topicCreator) {
					
					if (messageList.config.tc_highlight_color) {
						usernameElement.style.color = '#' + messageList.config.tc_highlight_color;
					}				
				}
			}
		},
		
		label_tc: function(msg) {
			var isAnonymous;
			var color;
			
			if (messageList.config.tc_label_color && messageList.config.tc_label_color != '') {
				color = messageList.config.tc_label_color;
			}
			
			var tops = msg.getElementsByClassName('message-top');
			
			for (var i = 0, len = tops.length; i < len; i++) {
				var top = tops[i];
				var usernameElement = top.firstChild.nextSibling;
				var username = usernameElement.nodeValue;
				
				if (!username || username == ' ') {
					usernameElement = top.getElementsByTagName('a')[0];
					username = usernameElement.innerHTML;
				}
				
				else {
					isAnonymous = true;
					username = username.replace(" | ", "").trim();
				}
				
				if (username.toLowerCase() == messageList.topicCreator) {
					var span = document.createElement('span');
					var b = document.createElement('b');
					var text = document.createTextNode('TC');
					var divider = document.createTextNode(' | ');
					
					b.appendChild(text);
					
					if (color) {
						b.style.color = '#' + color;
					}
					
					if (isAnonymous) {											
						span.appendChild(b);
						span.appendChild(divider);
					}
					else {
						span.appendChild(divider);
						span.appendChild(b);
					}
					
					top.insertBefore(span, usernameElement.nextSibling);				
				}	
			}
		}
	},
	
	infobarMethods: {
		imagemap_on_infobar: function() {
			// Adds link to imagemap for current topic on infobar
			var regex = window.location.search.match(/(topic=)([0-9]+)/);
			if (regex) {
				var topicNumber = regex[0];			
				var infobar = document.getElementsByClassName("infobar")[0];
				var pageRegex = window.location.search.match(/(page=)([0-9]+)/);
				var currentPage = ''
				if (pageRegex) {
					// Keep track of current page in case user decides to navigate back
					currentPage = '&oldpage=' + pageRegex[2];
				}
				var anchor = document.createElement('a');
				var divider = document.createTextNode(" | ");
				anchor.href = '/imagemap.php?' + topicNumber + currentPage;
				anchor.innerHTML = 'Imagemap';

                infobar.insertBefore(divider, infobar.lastChild);
                infobar.insertBefore(anchor, infobar.lastChild);
			}
		},
		
		filter_me: function() {
			var tops = document.getElementsByClassName('message-top');
			
			// Handle anonymous topics
			var userRegex = /user=(\d+)$/;
			if (!userRegex.test(tops[0].getElementsByTagName('a')[0].href)) {
				var quickpostElement = document.getElementsByClassName('quickpost-body')[0];					
									
				if (quickpostElement && quickpostElement.getElementsByTagName('a')) {
					var human = quickpostElement.getElementsByTagName('a')[0]
							.innerHTML.replace('Human #', '');
							
					if (isNaN(human)) {
						// User hasn't posted in topic yet
						return;					
					} 
					
					else {
						var me = '&u=-' + human;
					}
					
				}
				
				else {
					// Can't identify user
					return;
				}
			}
			
			// Handle non-anonymous topics
			else {					
				var me = '&u=' + document.getElementsByClassName('userbar')[0]
						.getElementsByTagName('a')[0].href
						.match(/\?user=([0-9]+)/)[1];
			}
			
			var topic = window.location.href.match(/topic=([0-9]+)/)[1];
			var anchor = document.createElement('a');		
			var divider = document.createTextNode(" | ");		
			
			if (window.location.href.indexOf(me) == -1) {
				anchor.href = window.location.href.split('?')[0] + '?topic=' + topic + me;
				anchor.innerHTML = 'Filter Me';
			} else {
				anchor.href = window.location.href.replace(me, '');
				anchor.innerHTML = 'Unfilter Me';
			}


			var infobar = document.getElementsByClassName('infobar')[0];
            infobar.insertBefore(divider, infobar.lastChild);
            infobar.insertBefore(anchor, infobar.lastChild);

		},
		
		expand_spoilers: function() {
			var infobar = document.getElementsByClassName('infobar')[0];
			var ains = document.createElement('span');
			var anchor = document.createElement('a');
			var divider = document.createTextNode(' | ');
			anchor.id = 'chromell_spoilers';
			anchor.href = '##';
			anchor.innerHTML = 'Expand Spoilers';
            infobar.insertBefore(divider, infobar.lastChild);
            infobar.insertBefore(anchor, infobar.lastChild);
			anchor.addEventListener('click', messageList.spoilers.find);
		}
	},
	
	quickpostMethods: {
		quick_imagemap: function() {
			var quickpost = document.getElementsByClassName('quickpost-body')[0];
			var button = document.createElement('button');
			var divider = document.createTextNode(' ');
			var search = document.createElement('input');
			button.textContent = "Browse Imagemap";					
			button.id = "quick_image";
			search.placeholder = "Press enter to search";
			search.id = "image_search";			
			quickpost.appendChild(divider);
			quickpost.appendChild(button);
			quickpost.appendChild(divider);
			quickpost.appendChild(search);
		},
		
		post_before_preview: function() {
			var inputs = document.getElementsByClassName('quickpost-body')[0]
					.getElementsByTagName('input');
			var input;
			var preview;
			var post;
			for (var i = 0, len = inputs.length; i < len; i++) {
				input = inputs[i];
				if (input.name == 'preview') {
					preview = input;
				}
				if (input.name == 'post') {
					post = input;
				}
			}
			post.parentNode.removeChild(post);
			preview.parentNode.insertBefore(post, preview);
		},
		
		batch_uploader: function() {
			var quickpost_body = document.getElementsByClassName('quickpost-body')[0];
			var ulBox = document.createElement('input');
			var ulButton = document.createElement('input');		
			ulBox.type = 'file';
			ulBox.multiple = true;
			ulBox.id = "batch_uploads";
			ulButton.type = "button";
			ulButton.value = "Batch Upload";
			ulButton.addEventListener('click', messageList.startBatchUpload);
			quickpost_body.insertBefore(ulBox, null);
			quickpost_body.insertBefore(ulButton, ulBox);
		},
		
		quickpost_on_pgbottom: function() {
			messageList.sendMessage({
				need: 'insertcss',
				file: 'src/css/quickpost_on_pgbottom.css' 
			});
		},
		
		quickpost_tag_buttons: function() {
			var m = document.getElementsByClassName('quickpost-body')[0];
			var txt = document.getElementById('u0_13');
			var insM = document.createElement('input');
			insM.value = 'Mod';
			insM.name = 'Mod';
			insM.type = 'button';
			insM.id = 'mod';
			insM.addEventListener("click", messageList.qpTagButton, false);
			var insA = document.createElement('input');
			insA.value = 'Admin';
			insA.name = 'Admin';
			insA.type = 'button';
			insA.addEventListener("click", messageList.qpTagButton, false);
			insA.id = 'adm';
			var insQ = document.createElement('input');
			insQ.value = 'Quote';
			insQ.name = 'Quote';
			insQ.type = 'button';
			insQ.addEventListener("click", messageList.qpTagButton, false);
			insQ.id = 'quote';
			var insS = document.createElement('input');
			insS.value = 'Spoiler';
			insS.name = 'Spoiler';
			insS.type = 'button';
			insS.addEventListener("click", messageList.qpTagButton, false);
			insS.id = 'spoiler';
			var insP = document.createElement('input');
			insP.value = 'Preformated';
			insP.name = 'Preformated';
			insP.type = 'button';
			insP.addEventListener("click", messageList.qpTagButton, false);
			insP.id = 'pre';
			var insU = document.createElement('input');
			insU.value = 'Underline';
			insU.name = 'Underline';
			insU.type = 'button';
			insU.addEventListener("click", messageList.qpTagButton, false);
			insU.id = 'u';
			var insI = document.createElement('input');
			insI.value = 'Italic';
			insI.name = 'Italic';
			insI.type = 'button';
			insI.addEventListener("click", messageList.qpTagButton, false);
			insI.id = 'i';
			var insB = document.createElement('input');
			insB.value = 'Bold';
			insB.name = 'Bold';
			insB.type = 'button';
			insB.addEventListener("click", messageList.qpTagButton, false);
			insB.id = 'b';
			m.insertBefore(insM, m.getElementsByTagName('textarea')[0]);
			m.insertBefore(insQ, insM);
			m.insertBefore(insS, insQ);
			m.insertBefore(insP, insS);
			m.insertBefore(insU, insP);
			m.insertBefore(insI, insU);
			m.insertBefore(insB, insI);
			m.insertBefore(document.createElement('br'), insB);
		},
		
		drop_batch_uploader: function() {
			var textarea = document.getElementById('message') || document.getElementsByTagName('textarea')[0];
			
			textarea.addEventListener('drop', (evt) => {
				
				var reader = new FileReader();
				
				for (let i = 0, len = evt.dataTransfer.files.length; i < len; i++) {
					
					allPages.asyncUploadHandler(evt.dataTransfer.files[i], (output) => {
						
						allPages.insertIntoTextarea(output);
						
					});
				}
				
				evt.preventDefault();
				
			});
		},
		
		snippet_listener: function() {
			var ta = document.getElementsByName('message')[0];
			
			ta.addEventListener('keydown', (event) => {
				
				if (messageList.config.snippet_alt_key) {
					if (event.shiftKey == true
							&& event.key == 'Tab') {
						event.preventDefault();
						messageList.snippet.handler(ta.value, ta.selectionStart);				
					}
				}
				
				else {
					if (event.key == 'Tab') {
						event.preventDefault();
						messageList.snippet.handler(ta.value, ta.selectionStart);
					}
				}
				
			});
		},

		emoji_menu: function() {
			messageList.emojis.addMenu();
		}
	},
		
	miscMethods: {
		pm_title: function() {
			if (window.location.href.indexOf('inboxthread.php') == -1) {
				return;
			}
			var me = document.getElementsByClassName('userbar')[0]
					.getElementsByTagName('a')[0].innerHTML;
			var other = '';
			var tops = document.getElementsByClassName('message-top');
			var top;
			for (var i = 0, len = tops.length; i < len; i++) {
				top = tops[i];
				if (top.getElementsByTagName('a')[0].innerHTML.indexOf(me) == -1) {
					other = top.getElementsByTagName('a')[0].innerHTML;
					break;
				}
			}
			document.title = "PM - " + other;
		},
		
		post_title_notification: function() {
			document.addEventListener('visibilitychange', messageList.clearUnreadPostsFromTitle);
			document.addEventListener('scroll', messageList.clearUnreadPostsFromTitle);
			document.addEventListener('mousemove', messageList.clearUnreadPostsFromTitle);
		},
		
		click_expand_thumbnail: function(newPost) {
			var messages;
			if (newPost && typeof newPost != 'string') {
				messages = newPost.getElementsByClassName('message');
			} else {
				messages = document.getElementsByClassName('message');
			}
			for (var i = 0, len = messages.length; i < len; i++) {
				var message = messages[i];
				// rewritten by xdrvonscottx
				// find all the placeholders before the images are loaded
				var pholds = message.getElementsByClassName('img-placeholder');

				for (var j = 0; j < pholds.length; j++) {
					var phold = pholds[j];
					messageList.media.imgPlaceholderObserver.observe(phold, {
						attributes: true,
						childList: true
					});
				}
			}
		}
	},
	
	omittedQuoteLoader: {
		
		loadMessage: function(anchor) {
			var mssgurl = anchor.id;
			var newSpan = document.createElement('span');
			newSpan.innerHTML = 'Loading message...';
			var loadingImg = new Image();
			loadingImg.src = 'data:image/gif;base64,'
					+ 'R0lGODlhEAAQAPIAAP///2Zm/9ra/o2N/mZm/6Cg/rOz/r29/iH/C05FVFNDQVBFMi4wAwEAAAAh/hpD'
					+ 'cmVhdGVkIHdpdGggYWpheGxvYWQuaW5mbwAh+QQJCgAAACwAAAAAEAAQAAADMwi63P4wyklrE2MIOggZ'
					+ 'nAdOmGYJRbExwroUmcG2LmDEwnHQLVsYOd2mBzkYDAdKa+dIAAAh+QQJCgAAACwAAAAAEAAQAAADNAi6'
					+ '3P5OjCEgG4QMu7DmikRxQlFUYDEZIGBMRVsaqHwctXXf7WEYB4Ag1xjihkMZsiUkKhIAIfkECQoAAAAs'
					+ 'AAAAABAAEAAAAzYIujIjK8pByJDMlFYvBoVjHA70GU7xSUJhmKtwHPAKzLO9HMaoKwJZ7Rf8AYPDDzKp'
					+ 'ZBqfvwQAIfkECQoAAAAsAAAAABAAEAAAAzMIumIlK8oyhpHsnFZfhYumCYUhDAQxRIdhHBGqRoKw0R8D'
					+ 'YlJd8z0fMDgsGo/IpHI5TAAAIfkECQoAAAAsAAAAABAAEAAAAzIIunInK0rnZBTwGPNMgQwmdsNgXGJU'
					+ 'lIWEuR5oWUIpz8pAEAMe6TwfwyYsGo/IpFKSAAAh+QQJCgAAACwAAAAAEAAQAAADMwi6IMKQORfjdOe8'
					+ '2p4wGccc4CEuQradylesojEMBgsUc2G7sDX3lQGBMLAJibufbSlKAAAh+QQJCgAAACwAAAAAEAAQAAAD'
					+ 'Mgi63P7wCRHZnFVdmgHu2nFwlWCI3WGc3TSWhUFGxTAUkGCbtgENBMJAEJsxgMLWzpEAACH5BAkKAAAA'
					+ 'LAAAAAAQABAAAAMyCLrc/jDKSatlQtScKdceCAjDII7HcQ4EMTCpyrCuUBjCYRgHVtqlAiB1YhiCnlsR'
					+ 'kAAAOwAAAAAAAAAAAA==';
			anchor.parentNode.insertBefore(newSpan, anchor);
			anchor.parentNode.replaceChild(loadingImg, anchor);
			var ajax = new XMLHttpRequest();
			ajax.open('GET', window.location.protocol + '//boards.endoftheinter.net/message.php?' + mssgurl, true);
			ajax.send(null);
			
			ajax.onload = () => {
				if (ajax.status == 200) {
					messageList.omittedQuoteLoader.processPage(ajax.responseText, newSpan);
					loadingImg.parentNode.removeChild(loadingImg);
					newSpan.parentNode.removeChild(newSpan);
				} else {
					alert("An error occurred loading the message. Fuck shit.");
				}
			};
			
		},
		
		processPage: function(response, element) {
			var newPage = document.createElement("div");
			newPage.innerHTML = response;
			var newMessage = newPage.getElementsByClassName('message')[0];	
			var scripts = newMessage.getElementsByTagName('script');
			
			// Find ImageLoader scripts and replace them with images
			for (var i = scripts.length - 1; i >= 0; i--) {
				var script = scripts[i];
				
				if (/ImageLoader/.test(script.text)) {
					// Create img element using parameters for ImageLoader constructor. 
					// (we can discard 1st parameter)
					var parameters = script.text.replace(')})', '').split(',');
					parameters.shift();
										
					var imageUrl = parameters[0].replace(/\\/g, '');
					imageUrl = imageUrl.replace('"//', window.location.protocol + '//');
					imageUrl = imageUrl.substring(0, imageUrl.length - 1);
					// Make sure that we load thumbnails, not fullsize images. Note that thumbnails always have .jpg extension
					imageUrl = imageUrl.replace('i/n', 'i/t').substr(0, imageUrl.lastIndexOf(".")) + ".jpg";					
					
					var img = document.createElement('img');
					img.src = imageUrl;
					
					img.onload = function() {
						// Need to set width/height properties for drag-resizing to work
						this.width = this.getBoundingClientRect().width;
						this.height = this.getBoundingClientRect().height;
						messageList.media.addDragToResizeListener(this);
						this.parentNode.className = 'img-loaded';
					};
					
					var placeholder = script.previousSibling;
					// Clear style properties (because it could refer to size of fullsize image)
					placeholder.style = '';
					placeholder.appendChild(img);
					
					// Enable click-to-expand thumbnails for this image
					messageList.media.imgPlaceholderObserver.observe(placeholder, {
						attributes: true,
						childList: true
					});
					
					// We don't need this anymore
					script.remove();									
				}
			}
			
			// Find spoiler tags and attach click listeners to handle open/closing action
			var spoilers = newMessage.getElementsByClassName('spoiler_on_close');
			for (var i = 0, len = spoilers.length; i < len; i++) {
				var spoiler = spoilers[i];
				
				spoiler.addEventListener('click', (evt) => {
					messageList.spoilers.toggle(evt.target);
					evt.preventDefault();
				});
				
				spoiler.nextSibling.addEventListener('click', (evt) => {
					messageList.spoilers.toggle(evt.target);
					evt.preventDefault();
				});				
				
			}
			
			if (newMessage.innerHTML.indexOf('---') != -1) {
				var j = 0;
				while (newMessage.childNodes[j]) {
					if (newMessage.childNodes[j].nodeType == 3
							&& newMessage.childNodes[j].nodeValue
									.indexOf('---') != -1) {
						while (newMessage.childNodes[j]) {
							newMessage.removeChild(newMessage.childNodes[j]);
						}
					}
					j++;
				}
			}						
			
			element.parentNode.appendChild(newMessage);			
		}
	},
	
	livelinksMethods: {	
		autoscroll_livelinks: function(mutation, top) {
			if (document.hidden && messageList.autoscrollCheck(mutation)) {				
				mutation.scrollIntoView();					
			}
		},
		
		autoscroll_livelinks_active: function(mutation, top) {
			if (!document.hidden && messageList.autoscrollCheck(mutation)) {
						
				// trigger after 10ms delay to prevent undesired behaviour in post_title_notification
				setTimeout(() => {						
					// set autoscrolling to true to prevent clearUnreadPostsFromTitle from being triggered
					messageList.autoscrolling = true;
					$.scrollTo((mutation), 800);						
				}, 10);
				
				setTimeout(() => {
					messageList.autoscrolling = false;	
				}, 850);
			}
		},
		
		post_title_notification: function(mutation, top) {
			if (mutation.style.display === "none") {
				if (messageList.config.debug) {
					console.log('not updating for ignorated post');
				}
				return;
			}
			if (mutation.getElementsByClassName('message-top')[0]
					.getElementsByTagName('a')[0].innerHTML == document
					.getElementsByClassName('userbar')[0].getElementsByTagName('a')[0].innerHTML
					.replace(/ \((\d+)\)$/, "")) {
				return;
			}
			var posts = 1;
			var ud = '';
			if (document.getElementsByClassName('message-container')[49]) {
				ud = ud + "+";
			}
			
			if (/\(\d+\)/.test(document.title)) {
				posts = parseInt(document.title.match(/\((\d+)\)/)[1]);
				document.title = "(" + (posts + 1) + ud + ") "
						+ document.title.replace(/\(\d+\) /, "");
			} 
			
			else {
				document.title = "(" + posts + ud + ") " + document.title;
			}
		},
		
		notify_quote_post: function(mutation, top) {
			if (!mutation.getElementsByClassName('quoted-message')) {
				return;
			}
			
			if (top.getElementsByTagName('a')[0].innerHTML == document
					.getElementsByClassName('userbar')[0].getElementsByTagName('a')[0].innerHTML
					.replace(/ \((\d+)\)$/, "")) {
				// dont notify when quoting own posts
				return;
			}
			
			var shouldNotify = false;
			
			var quotedMessages = mutation.getElementsByClassName('quoted-message');
			var currentUser = document.getElementsByClassName('userbar')[0]
					.getElementsByTagName('a')[0].innerHTML.replace(/ \((.*)\)$/, "");
					
			for (var i = 0; i < quotedMessages.length; i++) {					
				if (quotedMessages[i].getElementsByClassName('message-top')[0]
						.getElementsByTagName('a')[0].innerHTML == currentUser) {
							
					if (quotedMessages[i].parentNode.className != 'quoted-message') {
						// only display notification if user has been directly quoted
						shouldNotify = true;
					}
				}
			}
			
			if (shouldNotify) {					
				var user = mutation.getElementsByClassName('message-top')[0].getElementsByTagName('a')[0].innerHTML;
				
				messageList.sendMessage({
					need: "notify",
					title: "Quoted by " + user,
					message: document.title.replace(/End of the Internet - /i, '')
				});						
			}
		}
	},
	
	readPost: function(container) {
		var msg = container.getElementsByClassName('message')[0];
		var speech = '';
		var children = msg.childNodes;
		
		// Scrape post content from message element.		
		for (var i = 0, len = children.length; i < len; i++) {
			var child = children[i];
			
			// Stop scraping once we reach sig belt
			if (child.nodeValue && child.nodeValue.replace(/^\s+|\s+$/g, "") === '---') {
				break;
			}

			else {
				// Scrape text nodes and bold/italic/underline/preformatted content
				// This will ignore quoted messages, links, and spoilers
				
				if (child.nodeType === 3) {
					speech += child.nodeValue;
				}
				
				else if (child.tagName) {
					if (child.tagName === 'B' || child.tagName === 'I' || child.tagName === 'U') {
						speech += child.innerText;
					}
				}
				
				else if (child.className && child.className === 'pr') {
					speech += child.innerText;
				}
			}
		}
		
		window.speechSynthesis.speak(new SpeechSynthesisUtterance(speech));
	},	
	
	handleEvent: {
		
		/**
		 *  Takes message containing name user, and unhides any currently ignorated posts by that user
		 */
		
		onReceiveMessage: function(msg) {
			if (msg.action === 'showIgnorated') {
				var ignoratedPosts = document.getElementsByClassName('ignorated');
				var postsToShow = [];
				
				for (var i = 0, len = ignoratedPosts.length; i < len; i++) {
					var ignoratedPost = ignoratedPosts[i];
					var usernameElement = ignoratedPost.getElementsByTagName('a')[0];
					
					if (msg.value.toLowerCase() == usernameElement.innerHTML.toLowerCase()) {
						postsToShow.push(ignoratedPost);
					}							
				}
				
				// Iterate backwards so we can swap classes
				for (var i = postsToShow.length - 1; i >= 0; i--) {
					var postToShow = postsToShow[i];														
					postToShow.classList.remove('ignorated');
					// ignorated_post_peek sets display to "block" and opacity to 0.7
					postToShow.classList.add('ignorated_post_peek');
					
					if (i === 0) {
						$.scrollTo(postToShow);
					}
				}
			}
		},

		
		/**
		 *  After updating extension or reloading background page, it's not possible to send or receive messages
		 *  from orphaned content scripts (see https://bugs.chromium.org/p/chromium/issues/detail?id=168263).
		 *  If we detect the onDisconnect event, we should save user input and reload the page.
		 */	 
		
		onPortDisconnect: function(port) {
			if (document.getElementsByClassName('quickpost').length > 0) {
				var quickpost = document.getElementsByName('message')[0];
				sessionStorage.setItem('quickpost_value', quickpost.value);
				sessionStorage.setItem('quickpost_caret_position', quickpost.selectionStart);
			}
			
			sessionStorage.setItem('scrollx', window.scrollX);
			sessionStorage.setItem('scrolly', window.scrollY);
			
			setTimeout(() => { 
				window.location.reload(); 
			}, 2000);
		},

		/**
		 *  Recieves new livelinks posts and applies any required modifications
		 */
		
		newPost: function(container) {
			var top = container.getElementsByClassName('message-top')[0];
			var index = document.getElementsByClassName('message-container').length;
			var pm = '';
			
			if (window.location.pathname === '/inboxthread.php') {			
				pm = "_pm";
			}
			
			if (this.config.microsoft_sam && this.tags.includes('Microsoft Sam') && window.speechSynthesis) {
				this.readPost(container);	
			}
			
			for (var i in this.messageContainerMethods) {
				if (this.config[i + pm]) {
						// Fourth parameter signifies that we are dealing with livelinks post						
						this.messageContainerMethods[i](container, top, index, true);
				}
			}
			
			for (var i in this.livelinksMethods) {
				if (this.config[i+ pm]) {
					this.livelinksMethods[i](container, top);
				}
			}
			
			this.addListeners(container);
			this.links.check(container);
			
			if (this.config.click_expand_thumbnail) {
				this.miscMethods.click_expand_thumbnail(container);
			}
			
			var usernameElement = top.getElementsByTagName('a')[0];
			
			// Add username_anchor class for user info popup mouseenter listener
			if (usernameElement.innerHTML != 'Filter' && this.config.user_info_popup) {
				usernameElement.className = 'username_anchor';
			}
					
			if (!this.config.hide_ignorator_badge) {
				
				var ignoratorData = {
					action: 'ignorator_update',
					ignorator: this.ignorated,
					scope: "messageList"
				};
				
				try {
					// Send updated ignorator data to background page
					this.globalPort.postMessage(ignoratorData);
					
				} catch(e) {
					// We should attempt to reinitialise the connections to background page
					this.globalPort = chrome.runtime.connect();
					
					if (this.globalPort) {
						this.globalPort.onMessage.addListener(this.handleEvent.ignoratorUpdate);
					}
					
					try {
						// Send data again
						this.globalPort.postMessage(ignoratorData);
						console.log('Warning: content script was disconnected from background page, but recovered');
						
					} catch(e) {
						// Not much else we can do - wait for user to reload the page.
						console.log('Error while sending data to background page:', e);
					}
				}
			}
		},

		
		/**
		 *  Because ChromeLL adds so many clickable elements to the screen,
		 *  we use a single handler for click events and detirmine which was 
		 *  clicked from its attributes. This prevents us from having 
		 *  to attach a listener to each element on creation.
		 */ 
		 
		mouseclick: function(evt) {
			if (this.config.post_templates) {
				this.postTemplateAction(evt.target);
			}
			
			switch (evt.target.id) {
				case 'notebook':
					this.usernotes.open(evt.target);
					evt.preventDefault();
					return;
					
				case 'quick_image':
					// Note: imagemap object located in imagemap.js
					imagemap.init();
					evt.preventDefault();
					return;
			}
			
			switch (evt.target.className) {
				case 'l':		
					// Fix relative URLs for LUEpedia (note that index === 0)
					if (evt.target.title.indexOf("/index.php") === 0) {
						this.links.fixRelativeUrls(evt.target, "wiki");
						evt.preventDefault();						
					}
					
					// Fix relative URLs for imagemap
					else if (evt.target.title.indexOf("/imap/") === 0) {
						this.links.fixRelativeUrls(evt.target, "imagemap");					
						evt.preventDefault();
					}
					
					// Fix relative URLs for archive links
					else if (evt.target.innerHTML.indexOf('://archives.endoftheinte') > -1) {
						this.links.fixRelativeUrls(evt.target, "archives");
						evt.preventDefault();												
					}
			
					return;
					
				case 'emoji_button':
					this.emojis.toggleMenu(evt);
					evt.preventDefault();
					return;		

				case 'clear_emoji_history':
					this.emojis.clearHistory();
					evt.preventDefault();
					return;					
			
				case 'like_button':
					this.likeButton.buildText(evt.target);
					evt.preventDefault();
					return;
				
				case 'like_button_custom':
					var templateNumber = evt.target.id;
					for (var i = 0, len = evt.path.length; i < len; i++) {
						var pathNode = evt.path[i];
						if (pathNode.className == 'like_button') {
							this.likeButton.buildText(pathNode, templateNumber);			
							break;
						}
					}
					evt.preventDefault();				
					return;
					
				case 'archivequote':
					this.archiveQuotes.handler(evt);
					evt.preventDefault();
					return;
					
				case 'youtube':
					if (evt.target.tagName === 'DIV') {
						// Prevent clicks on div from bubbling up to parent
						evt.preventDefault();
						return;
					}
					else {
						// Prevent [Embed] links from remaining on screen if user navigates to the YouTube link					
						this.youtube.hideEmbedLink();
					}
					return;
					
				case 'embed_nws_gfy':
					var gfycatID = evt.target.parentNode.id.replace('_embed', '');
					this.gfycat.embed(document.getElementById(gfycatID));
					evt.preventDefault();
					return;
					
				case 'embed_nws_imgur':
					this.imgur.embed(evt.target.parentNode);
					evt.preventDefault();
					break;
					
				case 'embed':
					this.youtube.embed(evt.target.parentNode);
					evt.preventDefault();
					return;

				case 'hide':
					this.youtube.hide(evt.target.parentNode);
					// Manually remove [Hide] span
					this.youtube.hideEmbedLink();
					evt.preventDefault();
					return;				

				case 'embed_tweet':
					this.twitter.embed(evt.target.parentNode);
					evt.preventDefault();
					return;

				case 'emoji_type':
					this.emojis.switchType(evt);
					evt.preventDefault();
					return;
					
				case 'emoji':
					this.emojis.selectEmoji(evt);
					evt.preventDefault();
					return;
			}
			
			// Prevent default anchor of img anchors while shift key is held down for image resizing
			if (evt.target.parentNode && evt.target.parentNode.className === 'img-loaded') {
				if (evt.shiftKey) {					
					evt.preventDefault();
					return;
				}
			}
			
			// Capture [Quoted text omitted] clicks so we can use quote loader instead of redirecting to anchor href
			if (messageList.config.loadquotes && evt.target.tagName === 'A' && evt.target.innerHTML === '[quoted text omitted]') {
				var parts = evt.target.parentNode.getAttribute('msgid').split(',');
				var secondsplit = parts[2].split('@');
				evt.target.id = 'id=' + secondsplit[0] + '&topic=' + parts[1] + '&r=' + secondsplit[1];
				messageList.omittedQuoteLoader.loadMessage(evt.target);
				evt.preventDefault();
				return;
			}
		},		
		
		mouseenter: function(evt) {
			switch (evt.target.className) {
				case 'like_button':
					if (this.config.custom_like_button && this.config.custom_like_data.length > 0) {
						this.cachedEvent = evt;
						this.menuDebouncer = setTimeout(this.likeButton.showOptions.bind(this.likeButton), 250);
					}
					break;
				
				case 'username_anchor':
					allPages.cachedEvent = evt;
					this.popupDebouncer = setTimeout(allPages.userInfoPopup.handler.bind(allPages.userInfoPopup), 750);				
					break;
				
				case 'youtube':
					this.youtube.debouncerId = setTimeout(this.youtube.showEmbedLink.bind(this.youtube, evt), 400);
					break;
				
				default:
					break;
			}
			
			if (evt.target.className && evt.target.classList.contains('nws_gfycat')) {
				this.gfycat.debouncerId = setTimeout(this.gfycat.showEmbedLink.bind(this.gfycat, evt), 400);
			}
			
			else if (evt.target.className && evt.target.classList.contains('nws_imgur')) {
				this.imgur.debouncerId = setTimeout(this.imgur.showEmbedLink.bind(this.imgur, evt), 400);				
			}
			
			else if (evt.target.className && evt.target.classList.contains('click_embed_tweet')) {
				this.twitter.debouncerId = setTimeout(this.twitter.showEmbedLink.bind(this.twitter, evt), 400);
			}
		},
		
		mouseleave: function(evt) {
			clearTimeout(this.youtube.debouncerId);
			clearTimeout(this.gfycat.debouncerId);
			clearTimeout(this.imgur.debouncerId);
			clearTimeout(this.twitter.debouncerId);
			
			clearTimeout(this.menuDebouncer);
			clearTimeout(this.popupDebouncer);			
			
			if (document.getElementById('hold_menu')) {
				this.likeButton.hideOptions();
				evt.preventDefault();
			}
			else if (evt.target.className === 'youtube') {
				this.youtube.hideEmbedLink();
			}
			else if (evt.target.className === 'nws_gfycat') {
				this.gfycat.hideEmbedLink();
			}
			else if (evt.target.classList.contains('nws_imgur')) {
				this.imgur.hideEmbedLink();
			}
			else if (evt.target.classList.contains('click_embed_tweet')) {
				this.twitter.hideEmbedLink();
			}
			
		},
		
		keydown: function(evt) {
			const RETURN_KEY = 13;
			
			if (document.activeElement.id === 'image_search') {
				if (evt.keyCode === RETURN_KEY) {
					imagemap.search.init.call(imagemap.search);
					clearTimeout(this.searchDebouncer);
					evt.preventDefault();					
				}
				
				if (this.config.auto_image_search) {
					this.searchDebouncer = setTimeout(imagemap.search.init.call(imagemap.search), 400);
				}
			}
		}
	},

	
	/**
	 *  To reduce CPU load, we only embed videos that are visible in viewport,
	 *  and pause any videos which are no longer visible.
	 */
	
	mediaLoader: function() {
		var links = document.getElementsByClassName('media');
		var height = window.innerHeight;
		
		var linksToIgnore = [];
					
		for (var i = 0, len = links.length; i < len; i++) {
			var link = links[i];
			var position = link.getBoundingClientRect();
			var nameAttribute = link.getAttribute('name');
			// use window height + 200 to increase visibility of gfycatLoader
			if (position.top > height + 200 || position.bottom < 0) {
						
				if (nameAttribute == 'embedded' || nameAttribute == 'embedded_thumb') {
						
					if (!link.getElementsByTagName('video')[0].paused) {
						// pause hidden video elements to reduce CPU load
						link.getElementsByTagName('video')[0].pause();							
					}
				}
			}
			
			else if (link.tagName == 'A') {
				messageList.preventSigEmbeds(link);
				
				if (link.classList.contains('gfycat')) {
					messageList.gfycat.checkLink(link);
				}
				
				else if (link.classList.contains('imgur')) {
					messageList.imgur.checkLink(link);
				}
						
				else if (link.classList.contains('twitter')) {
					messageList.twitter.checkLink(link);					
				}
				else if (link.classList.contains('ignore')) {
					linksToIgnore.push(link);
				}
			}
			
			else if (nameAttribute == 'placeholder') {
				if (link.classList.contains('gfycat')) {
					messageList.gfycat.embed(link);					
				}
				else if (link.classList.contains('imgur')) {
					messageList.imgur.embed(link);					
				}
			}
			
			else if (nameAttribute == 'embedded' && link.getElementsByTagName('video')[0].paused) {
				link.getElementsByTagName('video')[0].play();
			}
		}
		
		// Remove all other classes from links that should not be embedded
		for (var i = 0, len = linksToIgnore.length; i < len; i++) {
			linksToIgnore[i].className = 'l';
		}
	},
	
	
	/**
	 *  Called after visibilitychange event fires
	 */
	
	mediaPauser: function() {				
		if (document.hidden) {
			var videos = document.getElementsByTagName('video');
			var video;
			for (var i = 0, len = videos.length; i < len; i++) {
				video = videos[i];
				if (video.src && !video.paused) {
					video.pause();
				}
			}
		}
		else {
			// call gfycatLoader so that only visible gfycat videos are played
			messageList.mediaLoader();
		}
	},
	
	preventSigEmbeds: function(element) {
		var message = element.closest(".message");

		if (message.innerHTML.indexOf('---') === -1) {
			// No sig - do nothing
			return;
		}
		
		var nodes = message.childNodes;
		var i = nodes.length - 1;
				
		// For long posts, it will be much quicker to iterate backwards to find sig belt.
		// It also makes sure that we don't detect any false positives.
		while (i--) {
			var node = nodes[i];
			if (node.nodeType === 3 && node.nodeValue.replace(/^\s+|\s+$/g, "") === '---') {
				var sigIndex = Array.prototype.indexOf.call(nodes, node);
				var mediaIndex = Array.prototype.indexOf.call(nodes, element);
				if (mediaIndex > sigIndex) {
					// Remove imgur/gfycat classes so that mediaLoader() doesn't attempt to embed this element
					element.classList.remove('imgur', 'gfycat');
					element.classList.add('ignore');
				}
				break;
			}	
		}				
	},
	
	gfycat: {
		debouncerId: '', // id for setTimeout()
		
		checkLink: function(gfycatElement) {
			var url = gfycatElement.getAttribute('href');
			
			if (!gfycatElement.classList.contains('checked')) {
				
				gfycatElement.classList.add('checked');
						
				this.getDataFromApi(url, (data) => {
					
					if (data === "error") {
						// revert class name to stop gfycat loader from detecting link
						gfycatElement.className = 'l';
						return;
					}						
					
					else {
						messageList.gfycat.checkWorkSafe(gfycatElement, data.nsfw, (safeForWork) => {
							
							if (!safeForWork && messageList.config.hide_nws_gfycat && !messageList.tags.includes('NWS') && !messageList.tags.includes('NLS')) {
								gfycatElement.classList.remove('gfycat');
								gfycatElement.classList.add('nws_gfycat');
								gfycatElement.setAttribute('w', data.width);
								gfycatElement.setAttribute('h', data.height);
								gfycatElement.id = data.webm;
								gfycatElement.addEventListener('mouseenter', messageList.handleEvent.mouseenter.bind(messageList));
								gfycatElement.addEventListener('mouseleave', messageList.handleEvent.mouseleave.bind(messageList));
							}
							
							else {					
								if (gfycatElement.getAttribute('name') == 'gfycat_thumb') {								
									var splitURL = url.split('/').slice(-1);
									var code = splitURL.join('/');
									var thumbnailUrl = 'http://thumbs.gfycat.com/' + code + '-poster.jpg';
									
									messageList.gfycat.createThumbnail(gfycatElement, url, thumbnailUrl, data);
								} 
								
								else {
									messageList.gfycat.createPlaceholder(gfycatElement, url, data);
								}
							}
							
						});
					}
				});			
			}	
		},
		
		getDataFromApi: function (url, callback) {
			var splitURL = url.split('/').slice(-1);
			var code = splitURL.join('/');
			var xhr = new XMLHttpRequest();
			xhr.open("GET", window.location.protocol + '//gfycat.com/cajax/get/' + code, true);
			xhr.onload = function() {
				if (xhr.status == 200) {
					var apiData = {};
					// gfycat api provides width, height, & webm url
					var response = JSON.parse(xhr.responseText);
					
					if (response.error) {
						callback("error");
						return;
					}
					
					var width = response.gfyItem.width;
					var height = response.gfyItem.height;
					
					if (messageList.config.resize_gfys 
							&& (width * messageList.zoomLevel) > messageList.config.gfy_max_width) {
								
						var ratio = messageList.config.gfy_max_width / (width * messageList.zoomLevel);
						width = messageList.config.gfy_max_width / messageList.zoomLevel;
						height *= ratio;				    
					}

					apiData.nsfw = response.gfyItem.nsfw;
					apiData.height = height;
					apiData.width = width;
					apiData.webm = response.gfyItem.webmUrl;
					
					callback(apiData);
				}
			};
			xhr.send();
		},
		
		createPlaceholder: function(gfycatElement, url, data) {
			// create placeholder
			var placeholder = document.createElement('div');
			placeholder.classList.add('media', 'gfycat');
			placeholder.id = data.webm;
			placeholder.setAttribute('name', 'placeholder');

			var video = document.createElement('video');
			video.setAttribute('width', data.width);
			video.setAttribute('height', data.height);
			video.setAttribute('loop', true);

			placeholder.appendChild(video);
			messageList.media.addDragToResizeListener(video);
			
			if (messageList.config.show_gfycat_link) {
				var linkSpan = document.createElement('a');
				linkSpan.href = url;
				linkSpan.innerHTML = '<br><br>' + url;
				placeholder.appendChild(linkSpan);
			}						
			
			gfycatElement.parentNode.insertBefore(placeholder, gfycatElement);
			gfycatElement.style.display = 'none';
			
			// check if placeholder is visible (some placeholders will be off screen)
			var position = placeholder.getBoundingClientRect();
			
			if (position.top > window.innerHeight) {
				return;
			} 
			
			else {
				// pass placeholder video element to embed function
				messageList.gfycat.embed(placeholder);
			}
		},
		
		createThumbnail: function(gfycatElement, url, thumbnailUrl, data) {			
			// create placeholder element
			var placeholder = document.createElement('div');
			placeholder.classList.add('media', 'gfycat');
			placeholder.id = data.webm;
			
			var thumbnail = document.createElement('img');
			thumbnail.setAttribute('src', thumbnailUrl);
			thumbnail.setAttribute('width', data.width);
			thumbnail.setAttribute('height', data.height);						
			
			placeholder.appendChild(thumbnail);
			
			messageList.media.addDragToResizeListener(thumbnail);
			
			if (messageList.config.show_gfycat_link) {
				var linkSpan = document.createElement('a');
				linkSpan.href = url;
				linkSpan.innerHTML = '<br><br>' + url;
				placeholder.appendChild(linkSpan);
			}
			
			gfycatElement.parentNode.insertBefore(placeholder, gfycatElement);
			gfycatElement.style.display = 'none';
			
			// add click listener to replace img with video
			var img = placeholder.getElementsByTagName('img')[0];
			img.title = "Click to play";
			
			img.addEventListener('click', (evt) => {
				
				evt.preventDefault();
				
				var video = document.createElement('video');
				video.setAttribute('width', data.width);
				video.setAttribute('height', data.height);
				video.setAttribute('loop', true);
				
				evt.target.parentNode.replaceChild(video, img);
				
				var video = placeholder.getElementsByTagName('video')[0];
				placeholder.setAttribute('name', 'embedded_thumb');
				video.src = placeholder.id;
				video.title = "Click to pause";
				video.play();
				
				video.addEventListener('click', () => {					
					video.title = "Click to play/pause";
					
					if (!video.paused) {
						video.pause();
					}
					
					else {
						video.play();
					}
					
				});
				
			});
		},
		
		checkWorkSafe: function(gfycatElement, nsfw, callback) {
			var userbar = document.getElementsByTagName('h2')[0];
			// only check topics without NWS/NLS tags
			if (!/N[WL]S/.test(userbar.innerHTML)) {
				
				var post = gfycatElement.parentNode;
				
				// Either API returned nsfw status, or message body includes "nws"/"nls"
				if (nsfw === '1' || post && /(n[wl]s)/i.test(post.innerHTML)) {
					gfycatElement.classList.remove('gfycat');
					gfycatElement.classList.add('nws_gfycat');
					callback(false);
				}
				
				else {
					callback(true);
				}
			}
			
			else {
				callback(true);
			}
		},
		
		showEmbedLink: function(evt) {
			var target = evt.target;
			var anchor = document.createElement('a');
			anchor.id = target.id;
			anchor.className = 'embed_nws_gfy';
			anchor.href = '#embed';
			anchor.style.backgroundColor = window.getComputedStyle(document.getElementsByClassName('message')[0]).backgroundColor;
			anchor.style.display = 'inline';
			anchor.style.position = 'absolute';
			anchor.style.zIndex = 1;
			anchor.style.fontWeight = 'bold';
			anchor.innerHTML = '&nbsp[Embed NWS Gfycat]';
			
			target.appendChild(anchor);
		},
		
		hideEmbedLink: function() {
			if (document.getElementsByClassName('embed_nws_gfy').length > 0) {
				var embedLink = document.getElementsByClassName('embed_nws_gfy')[0];
				embedLink.parentNode.removeChild(embedLink);
			}
		},
		
		embed: function(placeholder) {
			if (placeholder.classList.contains('gfycat')) {
				// use placeholder element to embed gfycat video
				var video = placeholder.getElementsByTagName('video')[0];
				placeholder.setAttribute('name', 'embedded');
				// placeholder id is webm url
				video.src = placeholder.id;
				video.play();
			}
			else if (placeholder.classList.contains('nws_gfycat')) {
				// create video element & embed gfycat
				var video = document.createElement('video');
				var width = placeholder.getAttribute('w');
				var height = placeholder.getAttribute('h');				
				video.setAttribute('width', width);
				video.setAttribute('height', height);
				video.setAttribute('name', 'embedded');
				video.setAttribute('loop', true);
				video.src = placeholder.id;				
				placeholder.parentNode.replaceChild(video, placeholder);			
				video.play();
			}
		}
	},
	
	imgur: {
		debouncerId: '',
		
		checkLink: function(imgurElement) {
			var href = imgurElement.href;
			
			if (!imgurElement.classList.contains('checked')) {
				imgurElement.classList.add('checked');
				
				this.getDataFromApi(href, (data) => {
					if (data.error) {
						// Make sure that this is only appended once
						if (imgurElement.classList.contains('imgur')) {
							var container = document.createElement('span');
							container.style.display = 'inline-block';
							
							var notFoundSpan = document.createElement('span');
							notFoundSpan.style.textDecoration = 'none';
							notFoundSpan.style.verticalAlign = 'super'; // Superscript
							notFoundSpan.style.fontSize = 'smaller';
							notFoundSpan.style.color = 'red';						
							notFoundSpan.innerHTML = '&nbsp' + data.status;
							notFoundSpan.title = data.error;
							
							// Append 404 in superscript
							container.appendChild(notFoundSpan);
							imgurElement.appendChild(container);
						}
						
						imgurElement.className = 'l';
						return;
					}									
					
					else if (messageList.config.hide_nws_gfycat && (data.nsfw || messageList.imgur.postContainsNsfw(imgurElement))) {
						imgurElement.classList.remove('imgur');
						imgurElement.classList.add('nws_imgur');
						imgurElement.setAttribute('width', data.width);
						imgurElement.setAttribute('height', data.height);
						imgurElement.id = data.url;
						imgurElement.addEventListener('mouseenter', messageList.handleEvent.mouseenter.bind(messageList));
						imgurElement.addEventListener('mouseleave', messageList.handleEvent.mouseleave.bind(messageList));					
					}
					
					else if (data.images_count && data.images_count > 0) {
						// Gallery link
						imgurElement.id = href;						
						messageList.imgur.createGallery(imgurElement, data);
					}
					
					else {
						if (imgurElement.getAttribute('name') == 'imgur_thumb') {
							// Get last path segment and strip any file extensions to find code for API
							var splitURL = href.split('/');
							var code = splitURL.slice(-1).join('/');
							code = code.split('.')[0];
							
							// Large thumbnail url
							var thumbnailUrl = window.location.protocol + '//i.imgur.com/' + code + 'l.jpg';
							
							messageList.imgur.createThumbnail(imgurElement, thumbnailUrl, data);
						}
						
						else if (!data.animated) {
							messageList.imgur.createThumbnail(imgurElement, data.url, data);							
						}
						
						else {
							messageList.imgur.createPlaceholder(imgurElement, data);
						}
					}
					
				});		
			}
		},
		
		postContainsNsfw: function(imgurElement) {
			// Matches nws with any whitespace (eg. n w s, nw s)
			return /(n(\s*?)[wl](\s*?)s)/i.test(imgurElement.parentNode.innerHTML);
		},
		
		getDataFromApi: function(href, callback) {
			// Documentation for the Imgur image data model: https://api.imgur.com/models/image
			const API_KEY = 'Client-ID 6356976da2dad83';			
			
			var url = 'https://api.imgur.com/3/' + this.getApiPath(href);
			
			chrome.runtime.sendMessage({
				
				need: "xhr",
				url: url,
				auth: API_KEY
				
			}, (response) => {
				
				var jsonResponse = JSON.parse(response);
				this.handleResponse(jsonResponse, callback);				
				
			});	
		},
		
		getApiPath: function(href) {
			// Get last path segment and strip any file extensions to find code for API
			var splitURL = href.split('/');
			var code = splitURL.slice(-1).join('/');
			code = code.split('.')[0];
			
			if (href.indexOf('/a/') > -1) {
				return 'album/' + code;
				
			}
			
			else if (href.indexOf('/gallery/') > -1) {
				return 'gallery/album/' + code;
			}
						
			else {
				return 'image/' + code;
			}
		},
		
		handleResponse: function(jsonResponse, callback) {
			// Check for errors
			if (!jsonResponse.success) {
				callback({ status: jsonResponse.status, error: jsonResponse.data.error });
			}
			
			else {			
				if (jsonResponse.data.images) {
					// Response from gallery/album/ request
					callback(this.prepareGalleryData(jsonResponse.data));					
				}
				
				else {					
					// Response from image/ request	
					callback(this.prepareImageData(jsonResponse.data));
				}												
			}
		},
		
		prepareImageData: function(data) {
			var preparedData = {};
			preparedData.nsfw = data.nsfw;
			preparedData.title = data.title;			
			preparedData.url = data.mp4 || data.link;
			preparedData.animated = data.animated;

			preparedData.width = data.width;
			preparedData.height = data.height;
			
			if (messageList.config.resize_gfys 
					&& (data.width * messageList.zoomLevel) > messageList.config.gfy_max_width) {
						
				var ratio = messageList.config.gfy_max_width / (data.width * messageList.zoomLevel);
				preparedData.width = messageList.config.gfy_max_width / messageList.zoomLevel;
				preparedData.height *= ratio;    
			}

			return preparedData;
		},
		
		prepareGalleryData: function(data) {
			var preparedData = {};
			preparedData.nsfw = data.nsfw;
			preparedData.title = data.title;			
			preparedData.description = data.description;
			preparedData.images = data.images;
			preparedData.images_count = data.images_count;
			
			return preparedData;
		},
		
		createGallery: function(imgurElement, data) {
			var index = 0;
			var imageData = this.prepareImageData(data.images[index]);
			
			if (data.images_count === 1) {
				this.createPlaceholder(imgurElement, imageData);
				return;
			}
			
			var galleryDiv = document.createElement('div');
			galleryDiv.className = 'imgur_gallery';
			galleryDiv.id = imgurElement.id;
			
			// Create title element using API data
			var galleryTitle = document.createElement('span');
			galleryTitle.className = 'imgur_gallery_title';
			galleryTitle.innerHTML = data.title;
			galleryDiv.appendChild(galleryTitle);
			
			// Display index of image in gallery
			var imageNumber = document.createElement('span');
			imageNumber.className = 'imgur_gallery_index';
			imageNumber.innerText = (index + 1) + '/' + data.images_count;
			galleryDiv.appendChild(imageNumber);
			
			// Create element for createPlaceholder() method to replace
			var dummyPlaceholder = document.createElement('div');
			galleryDiv.appendChild(dummyPlaceholder);
			
			if (imageData.animated) {
				this.createPlaceholder(dummyPlaceholder, imageData);
			}
			
			else {
				this.createThumbnail(dummyPlaceholder, imageData.url, imageData);
			}

			// Create navigation buttons
			var leftButton = document.createElement('span');
			leftButton.className = 'imgur_gallery_left';
			leftButton.innerText = '‹';
			
			var rightButton = document.createElement('span');
			rightButton.className = 'imgur_gallery_right';
			rightButton.innerHTML = '›';
			
			galleryDiv.appendChild(leftButton);
			galleryDiv.appendChild(rightButton);
			
			// Create description using API data
			/*var galleryDesc = document.createElement('span');
			galleryDesc.className = 'imgur_gallery_desc';
			galleryDesc.innerHTML = data.description;
			galleryDiv.appendChild(galleryDesc);*/
			
			imgurElement.parentNode.insertBefore(galleryDiv, imgurElement);
			imgurElement.style.display = 'none';
			
			// Add handlers for click events. Defined here so they can access the API data
			
			leftButton.addEventListener('click', (evt) => {
				
				if (index > 0) {
					
					index--;
					imageNumber.innerText = (index + 1) + '/' + data.images_count;
					this.displayNewGalleryImage(index, data, evt.target.parentNode.children[2]);
				}
				
			});
			
			rightButton.addEventListener('click', (evt) => {
												
				if (index < data.images_count - 1) {
					
					index++;
					imageNumber.innerText = (index + 1) + '/' + data.images_count;
					this.displayNewGalleryImage(index, data, evt.target.parentNode.children[2]);
				}
				
			});			
		},
		
		displayNewGalleryImage: function(index, data, oldDiv) {
			var imageData = this.prepareImageData(data.images[index]);
			
			var initialHeight = oldDiv.firstChild.height;
			
			if (imageData.height !== initialHeight) {
				var ratio = initialHeight / imageData.height;				
				imageData.width *= ratio;
				imageData.height = initialHeight;
			}
			
			if (imageData.animated) {
				this.createPlaceholder(oldDiv, imageData);
			}
			
			else {
				this.createThumbnail(oldDiv, imageData.url, imageData);
			}
		},
		
		createThumbnail: function(imgurElement, thumbnailUrl, data) {
			// create placeholder element
			var placeholder = document.createElement('div');
			if (data.title) {
				placeholder.title = data.title;
			}
			placeholder.classList.add('media', 'imgur');
			placeholder.id = data.url;
			
			var thumbnail = document.createElement('img');
			thumbnail.setAttribute('src', thumbnailUrl);
			thumbnail.setAttribute('width', data.width);
			thumbnail.setAttribute('height', data.height);

			placeholder.appendChild(thumbnail);
						
			if (messageList.config.show_gfycat_link) {
				var linkSpan = document.createElement('a');
				linkSpan.href = data.url;
				linkSpan.innerHTML = '<br><br>' + data.url;
				placeholder.appendChild(linkSpan);		
			}
			
			messageList.media.addDragToResizeListener(thumbnail);
		
			imgurElement.parentNode.insertBefore(placeholder, imgurElement);
			imgurElement.style.display = 'none';
			
			if (data.animated) {
				// add click listener to replace img with video
				var img = placeholder.getElementsByTagName('img')[0];
				img.title = "Click to play";
				
				img.addEventListener('click', (evt) => {
					
					evt.preventDefault();
					
					var video = document.createElement('video');
					video.setAttribute('width', data.width);
					video.setAttribute('height', data.height);
					video.setAttribute('loop', true);
					
					evt.target.parentNode.replaceChild(video, img);
					
					var video = placeholder.getElementsByTagName('video')[0];
					placeholder.setAttribute('name', 'embedded_thumb');
					video.src = placeholder.id;
					video.title = "Click to pause";
					video.play();
					
					video.addEventListener('click', () => {					
						video.title = "Click to play/pause";
						
						if (!video.paused) {
							video.pause();
						}
						
						else {
							video.play();
						}
						
					});
					
				});	
			}
		},
		
		createPlaceholder: function(imgurElement, data) {	
			// create placeholder
			var placeholder = document.createElement('div');			
			placeholder.title = data.title || data.url || data.mp4;
			placeholder.classList.add('media', 'imgur');
			placeholder.id = data.url || data.mp4;
			placeholder.setAttribute('name', 'placeholder');

			var video = document.createElement('video');
			video.setAttribute('width', data.width);
			video.setAttribute('height', data.height);
			video.setAttribute('loop', true);						

			placeholder.appendChild(video);
			
			messageList.media.addDragToResizeListener(video);

			if (messageList.config.show_gfycat_link) {
				var linkSpan = document.createElement('a');
				linkSpan.href = data.url;
				linkSpan.innerHTML = '<br><br>' + data.url;
				placeholder.appendChild(linkSpan);
			}
				
			imgurElement.parentNode.insertBefore(placeholder, imgurElement);
			imgurElement.style.display = 'none';
			
			// check if placeholder is visible (some placeholders will be off screen)
			var position = placeholder.getBoundingClientRect();
			
			if (position.top > window.innerHeight) {
				return;
			} 
			
			else {
				// pass placeholder video element to embed function
				messageList.imgur.embed(placeholder);
			}
		},
		
		embed: function(placeholder) {
			if (placeholder.classList.contains('imgur')) {
				// use placeholder element to embed gfycat video
				var video = placeholder.getElementsByTagName('video')[0];				
				placeholder.setAttribute('name', 'embedded');
				video.src = placeholder.id; // id is mp4 url
				video.play();
			}
			
			else if (placeholder.classList.contains('nws_imgur')) {
				// create video element & embed gfycat
				var video = document.createElement('video');
				var width = placeholder.getAttribute('width');
				var height = placeholder.getAttribute('height');		
				video.setAttribute('width', width);
				video.setAttribute('height', height);
				video.setAttribute('name', 'embedded');
				video.setAttribute('loop', true);
				video.src = placeholder.id;				
				placeholder.parentNode.replaceChild(video, placeholder);			
				video.play();
			}
		},
		
		showEmbedLink: function(evt) {
			var target = evt.target;
			var anchor = document.createElement('a');
			anchor.id = target.id;
			anchor.className = 'embed_nws_imgur';
			anchor.href = '#embed';
			anchor.style.backgroundColor = window.getComputedStyle(document.getElementsByClassName('message')[0]).backgroundColor;
			anchor.style.display = 'inline';
			anchor.style.position = 'absolute';
			anchor.style.zIndex = 1;
			anchor.style.fontWeight = 'bold';
			anchor.innerHTML = '&nbsp[Embed NWS Imgur]';
			
			target.appendChild(anchor);
		},
		
		hideEmbedLink: function() {
			if (document.getElementsByClassName('embed_nws_imgur').length > 0) {
				var embedLink = document.getElementsByClassName('embed_nws_imgur')[0];
				embedLink.parentNode.removeChild(embedLink);
			}
		}	
	},
	
	twitter: {
		debouncerId: 0,
		
		/**
		 *  Injects the Twitter for Websites script, required to display formatted tweets.
		 *  (if this fails for whatever reason, ChromeLL will still display a basic embedded tweet)
		 */
		
		injectWidgets: function() {
			var script = document.createElement('script');			
			script.src = chrome.extension.getURL('/lib/widgets.js');
			script.onload = function() {
					// Remove script element after loading
					this.remove();
			};
			document.head.appendChild(script);		
		},
		
		/**
		 *  We need to call twttr.widgets.load() to finish the embedding process, 
		 *  but we can't access window.twttr from ChromeLL. Similarly, we can't
		 *  add widgets.js as a content script because it relies on access to 
		 *  other window variables that are injected to the page (like window.__twttrll)
		 *
		 *  The solution is to inject the loading code into the page as a script element.
		 */
		
		injectLoadScript: function(id) {
			var script = document.createElement('script');
			script.innerHTML = 'if (window.twttr) { twttr.widgets.load(document.getElementById("' + id + '")) };';
			script.onload = function() {
					this.remove();
			};
			document.head.appendChild(script);
		},
		
		showEmbedLink: function(evt) {
			var target = evt.target;
			var span = document.createElement('span');
			span.id = target.id;
			span.className = 'embed_tweet';
			span.style.backgroundColor = window.getComputedStyle(document.getElementsByClassName('message')[0]).backgroundColor;
			span.style.display = 'inline';
			span.style.position = 'absolute';
			span.style.zIndex = 1;
			span.style.fontWeight = 'bold';
			span.style.textDecoration = 'underline';
			span.style.cursor = 'pointer';			
			span.innerHTML = '&nbsp[Embed]';
			
			target.appendChild(span);
		},
		
		hideEmbedLink: function() {
			if (document.getElementsByClassName('embed_tweet').length > 0) {
				var embedLink = document.getElementsByClassName('embed_tweet')[0];
				embedLink.parentNode.removeChild(embedLink);
			}
		},		
		
		checkLink: function(link) {
			if (!link.classList.contains('checked')) {

				if (link.classList.contains('click_embed_tweet')) {
					link.addEventListener('mouseenter', messageList.handleEvent.mouseenter.bind(messageList));
					link.addEventListener('mouseleave', messageList.handleEvent.mouseleave.bind(messageList));
				}
				
				else {
					this.embed(link);			
				}
				
				link.classList.add('checked');					
			}
		},
		
		postContainsNsfw: function(link) {
			if (messageList.tags.includes('NWS') || messageList.tags.includes('NLS')) {
				return true;
			}
			
			// Check post content for "nws"/"nls" strings
			if (link.parentNode.className === 'spoiler_on_open') {
				// We have to go deeper
				return /(n(\s*?)[wl](\s*?)s)/i.test(link.parentNode.parentNode.parentNode.innerHTML);
			}
			else {
				return /(n(\s*?)[wl](\s*?)s)/i.test(link.parentNode.innerHTML);
			}
		},
		
		checkHideMedia: function(link) {
			return messageList.config.hide_tweet_media || (messageList.config.hide_nws_tweets && this.postContainsNsfw(link));
		},
		
		getEmbedUrl: function(link) {
			return 'https://publish.twitter.com/oembed?url=' + encodeURIComponent(link.href) 
					+ '&omit_script=true'
					+ '&theme=' + ((messageList.config.dark_tweets) ? 'dark' : 'light')
					+ '&hide_media=' + ((this.checkHideMedia(link)) ? 'true' : 'false')
		},
		
		embed: function(link) {	
				
			fetch(this.getEmbedUrl(link))
			
					.then(response => {
						
						return response.json();
						
					}).then(data => {
						
						// Insert HTML from API to new element and insert before original
						var tweet = document.createElement('div');
						tweet.className = 'embedded_tweet';
						tweet.innerHTML = data.html;
						tweet.id = link.id;
						link.parentNode.insertBefore(tweet, link);
						
						// Revert class names and hide original element
						link.className = 'l';
						link.style.display = 'none';
						
						// Inject loading script so Twitter for Websites can do its thing
						this.injectLoadScript(tweet.id);
					});
		}
	},
	
	youtube: {
		debouncerId: '', // Stores setTimeout() id for embed link
		
		showEmbedLink: function(evt) {
			var target = evt.target;
			var span = document.createElement('span');
			span.id = target.id;
			span.className = 'embed';
			span.style.backgroundColor = window.getComputedStyle(document.getElementsByClassName('message')[0]).backgroundColor;
			span.style.display = 'inline';
			span.style.position = 'absolute';
			span.style.zIndex = 1;
			span.style.fontWeight = 'bold';
			span.style.textDecoration = 'underline';
			span.style.cursor = 'pointer';			
			span.innerHTML = '&nbsp[Embed]';
			
			target.appendChild(span);
		},
		
		hideEmbedLink: function() {
			if (document.getElementsByClassName('embed').length > 0) {
				var embedLink = document.getElementsByClassName('embed')[0];
				embedLink.parentNode.removeChild(embedLink);
			}
			else if (document.getElementsByClassName('hide').length > 0) {
				var embedLink = document.getElementsByClassName('hide')[0];
				embedLink.parentNode.removeChild(embedLink);
			}
		},
		
		embed: function(span) {
			var toEmbed = document.getElementById(span.id);
			var backgroundColor = window.getComputedStyle(document.getElementsByClassName('message')[0]).backgroundColor;
			var videoCode;
			var embedHTML;
			var href = toEmbed.href;
			var timeCode;
			var timeCodeCheck = href.match(/(\?|\&|#)(t=)/);
			if (timeCodeCheck) {
				var substring = href.substring(timeCodeCheck.index, href.length);
				timeCode = substring.match(/([0-9])+([h|m|s])?/g);
			}
			var regExp = /^.*(youtu.be\/|v\/|u\/\w\/\/|watch\?v=|\&v=)([^#\&\?]*).*/;			
			var match = span.id.match(regExp);
			
			if (match && match[2].length == 11) {
				videoCode = match[2];
			} 
			
			else {
				videoCode = match;
			}
			
			
			if (timeCode) {
				videoCode += this.buildTimeCode(timeCode);
			}
								
			this.hideEmbedLink();
			toEmbed.className = "hideme";
			toEmbed.appendChild(this.createYouTubeElements(span.id, videoCode, backgroundColor));
		},
		
		buildTimeCode: function(timeCode) {
			var seconds = 0;
			for (var i = 0, len = timeCode.length; i < len; i++) {
				var splitTime = timeCode[i];
				if (!/([h|m|s])/.test(splitTime)) {
					// timecode is probably in format "#t=xx" 
					seconds += splitTime;
				}
				else if (splitTime.indexOf('h') > -1) {
					var temp = Number(splitTime.replace('h', ''), 10);
					seconds += temp * 60 * 60;
				}
				else if (splitTime.indexOf('m') > -1) {
					var temp = parseInt(splitTime.replace('m', ''), 10);
					seconds += temp * 60;
				}
				else if (splitTime.indexOf('s') > -1) {
					seconds += parseInt(splitTime.replace('s', ''), 10);
				}
			}
			return "?start=" + seconds;			
		},
		
		createYouTubeElements: function(id, videoCode, backgroundColor) {
			const VIDEO_WIDTH = 640;
			const VIDEO_HEIGHT = 390;
			
			// Create span to hide embedded video
			var span = document.createElement('span');
			span.style.display = 'inline';
			span.style.position = 'absolute';
			span.style.backgroundColor = backgroundColor;
			span.style.fontWeight = 'bold';
			span.style.textDecoration = 'underline';
			span.style.cursor = 'pointer';
			span.style.zIndex = 1;
			span.className = 'hide';			
			span.id = id;
			span.innerHTML = '&nbsp[Hide]'
			
			var lineBreak = document.createElement('br');
			
			// Create div containing YouTube iframe
			var div = document.createElement('div');
			div.className = 'youtube';
			
			// Create iframe
			var iframe = document.createElement('iframe');
			iframe.id = 'yt' + id;
			iframe.src = 'https://www.youtube.com/embed/' + videoCode;
			
			iframe.setAttribute('type', 'text/html');
			iframe.setAttribute('width', VIDEO_WIDTH);
			iframe.setAttribute('height', VIDEO_HEIGHT);
			iframe.setAttribute('autoplay', 0);
			iframe.setAttribute('frameborder', 0);
			iframe.setAttribute('allowfullscreen', 'allowfullscreen');			
						
			var fragment = document.createDocumentFragment();
			
			div.appendChild(iframe);
			
			fragment.appendChild(span);
			fragment.appendChild(lineBreak);
			fragment.appendChild(div);
			
			return fragment;
		},
		
		hide: function(anchor) {
			var toEmbed = document.getElementById(anchor.id);
			var i = toEmbed.childNodes.length;
			var child;
			// iterate backwards as we are removing nodes
			while (i--) {
				child = toEmbed.childNodes[i];
				if (child.nodeName !== '#text'
					&& child.tagName !== 'SPAN') {
					toEmbed.removeChild(child);
				}
			}
			toEmbed.className = "youtube";
		}
	},
	
	snippet: {
		handler: function(ta, caret) {
			// detects keyword & replaces with snippet
			var text = ta.substring(0, caret);			
			var message = document.getElementsyName('message')[0];
			
			var words, word;
			
			if (text.indexOf(' ') > -1) {
				words = text.split(' ');
				word = words[words.length - 1];
				
				if (word.indexOf('\n') > -1) {
					// makes sure that line breaks are accounted for
					words = word.split('\n');
					word = words[words.length - 1];
				}
			}
			
			else if (text.indexOf('\n') > -1) {
				// line break(s) in text - no spaces
				words = text.split('\n');
				word = words[words.length - 1];
			}
			
			else {
				// first word in post
				word = text;
			}
			
			
			for (var key in messageList.config.snippet_data) {
				if (key === word) {
					var snippet = messageList.config.snippet_data[key];
					var index = text.lastIndexOf(word);
					var temp = text.substring(0, index);
					var ta = ta.replace(text, temp + snippet);
					message.value = ta;
					// manually move caret to end of pasted snippet as changing
					// message.value property moves caret to end of input)
					var newCaret = ta.lastIndexOf(snippet) + snippet.length;
					message.setSelectionRange(newCaret, newCaret);
				}
			}
		}	
	},
	
	usernotes: {
		open: function(el) {
			var userID = el.href.match(/note(\d+)$/i)[1];
			if (document.getElementById("notepage")) {
				var pg = document.getElementById('notepage');
				userID = pg.parentNode.getElementsByTagName('a')[0].href
						.match(/user=(\d+)$/i)[1];
				messageList.config.usernote_notes[userID] = pg.value;
				pg.parentNode.removeChild(pg);
				messageList.usernotes.save();
			} else {
				var note = messageList.config.usernote_notes[userID];
				page = document.createElement('textarea');
				page.id = 'notepage';
				page.value = (note == undefined) ? "": note;
				page.style.width = "100%";
				page.style.opacity = '.6';
				el.parentNode.appendChild(page);
			}
		},
		
		save: function() {
			messageList.sendMessage({
				need: "save",
				name: "usernote_notes",
				data: messageList.config.usernote_notes				
			});
		}
	},
	
	markupBuilder: {
		depth: 0,	
		
		/**
		 *  Iterates of children of message element and generates markup.
		 *  Called recursively to handle quoted-message and spoiler elements.
		 */
		
		build: function(parentElement) {
			var output = '';
			var childNodes = parentElement.childNodes;
			
			for (var i = 0, len = childNodes.length; i < len; i++) {			
				var node = childNodes[i];
				if (node.nodeType === 3) {
					if (node.nodeValue.replace(/^\s+|\s+$/g, "") != '---') {	
						output += node.nodeValue;
					}
					else {
						// Stop processing post once we reach sig belt
						break;
					}
				}
											
				if (node.tagName) {
					if (node.tagName == 'B' || node.tagName == 'I' || node.tagName == 'U') {
						var tagName = node.tagName.toLowerCase(); 
						output += '<' + tagName + '>' + node.innerText + '</' + tagName + '>';
					}
					else if (node.tagName == 'A') {
						output += node.href;
					}
				}
				
				if (node.className) {
					switch (node.className) {
						case 'pr':
							output += '<pre>' + node.innerHTML.replace(/<br>/g, '') + '</pre>';		
							break;
							
						case 'imgs':
							var imgNodes = node.getElementsByTagName('A');
							for (var l = 0, img_len = imgNodes.length; l < img_len; l++) {
								var imgNode = imgNodes[l];
								output += '<img imgsrc="' + imgNode.getAttribute('imgsrc') + '" />' + '\n';
							}				
							break;
							
						case 'spoiler_closed':
							output += this.buildSpoiler(node);
							break;
							
						case 'quoted-message':
							// getMarkup() is called recursively from inside getMarkupFromQuote(),
							// so this.depth can increase beyond 1 (depending on the level of nesting)
							this.depth++;
							output += this.buildQuote(node);
							this.depth--;
							break;													
						
						case 'media gfycat':
						case 'media imgur':
						case 'imgur_gallery':						
							// Embedded media elements have original href stored as element id
							output += node.id;
							break;
						
						default:
							// If child node doesn't fit into any of these cases, we can just ignore it
							break;
					}
				}
			}
			
			return output;
		},
		
		buildQuote: function(node) {
			var openQuote = '<quote>';
			var closeQuote = '</quote>';
			var msgId = node.attributes.msgid.value;
			if (msgId) {
				openQuote = '<quote msgid="' + msgId + '">';
			}						
			
			if (this.depth >= 2 && msgId) {
				// To match ETI behaviour when building markup, we have to omit quoted text if the quote depth 
				// reaches three levels of nesting. We should only do this if quote is attributed to another user
				return openQuote + closeQuote;	
			}
			
			else {
				return openQuote + this.build(node) + closeQuote;	
			}						
		},
				
		buildSpoiler: function(node) {
			var openSpoiler = '<spoiler>';
			var closeSpoiler = '</spoiler>';					
			var spoiler = node.getElementsByClassName('spoiler_on_open')[0];					
			var caption = node.getElementsByClassName('caption')[0].innerText.replace(/<|\/>/g, '');
			// Caption element contains an added whitespace character at end
			caption = caption.slice(0, -1);
			
			// We only need to include caption if it doesn't match the default text
			if (caption && caption !== 'spoiler') {
				openSpoiler = '<spoiler caption="' + caption + '">';
			}

			// First and last elements of node list are part of the UI and should not be included in markup
			spoiler.removeChild(spoiler.firstChild);
			spoiler.removeChild(spoiler.lastChild);
			
			return openSpoiler + this.build(spoiler) + closeSpoiler;
		}		
		
	},
	
	/**
	 *  General purpose media utilities
	 */
	
	media: {
		expandThumbnail: function(evt) {
			if (evt.shiftKey) {
				return;
			}
			
			// originally rewritten by xdrvonscottx			
			var num_children = evt.target.parentNode.parentNode.childNodes.length;
			// first time expanding - only span
			if (num_children == 1) {
				// build new span
				var newspan = document.createElement('span');
				newspan.setAttribute("class", "img-loaded");
				newspan.setAttribute("id", evt.target.parentNode.getAttribute('id') + "_expanded");								

				var fullsize = evt.target.parentNode.parentNode.getAttribute('imgsrc');
				
				// set proper protocol
				if (window.location.protocol == "https:") {
					fullsize = fullsize.replace(/^http:/i, "https:");
				}
				
				// build new img child for our newspan
				var newimg = document.createElement('img');				
				newimg.src = fullsize;
				newspan.insertBefore(newimg, null);
				
				newimg.onload = function() {
					messageList.media.addDragToResizeListener(this);					
				};				
				
				evt.target.parentNode.parentNode.insertBefore(newspan, evt.target.parentNode);
				evt.target.parentNode.style.display = "none"; // hide old img
			}
			
			// has been expanded before - just switch which node is hidden
			else if (num_children == 2) {
				// toggle their display statuses
				var children = evt.target.parentNode.parentNode.childNodes
				for (var i = 0; i < children.length; i++) {
					if (children[i].style.display == "none") {
						children[i].style.display = '';
					} else {
						children[i].style.display = "none";
					}
				}
			} 
			
			else if (messageList.config.debug) {
				console.log("Couldn't expand thumbnail - weird number of siblings");
			}
		},
		
		resize: function(el) {
			var width = el.width;			
			if ((width * messageList.zoomLevel) > messageList.config.img_max_width) {
				// take zoom level into account when resizing images
				el.height = (el.height / (el.width / messageList.config.img_max_width) / messageList.zoomLevel);
				el.parentNode.style.height = el.height + 'px';
				el.width = messageList.config.img_max_width / messageList.zoomLevel;
				el.parentNode.style.width = el.width + 'px';
			}
		},
				
		imgPlaceholderObserver: new MutationObserver((mutations) => {
			for (var i = 0; i < mutations.length; i++) {
				var mutation = mutations[i];
				
				if (messageList.config.resize_imgs) {
					messageList.media.resize(mutation.target.childNodes[0]);
				}
				
				if (mutation.type === 'attributes') {
					// once they're loaded, thumbnails have /i/t/ in their url where fullsize have /i/n/
					if (mutation.attributeName == "class" && mutation.target.getAttribute('class') == "img-loaded") {
						
						var imgLoadedSpan = mutation.target;
							
						if (/.*\/i\/t\/.*/.test(imgLoadedSpan.firstChild.src)) {
							/*
							 * set up the onclick and do some dom manip that the
							 * script originally did - i think only removing href
							 * actually matters
							 */
							imgLoadedSpan.parentNode.addEventListener('click', messageList.media.expandThumbnail);				
							imgLoadedSpan.parentNode.setAttribute('class', 'thumbnailed_image');
							imgLoadedSpan.parentNode.setAttribute('oldHref', mutation.target.parentNode.getAttribute('href'));
							imgLoadedSpan.parentNode.removeAttribute('href');							
						}
						
						var img = imgLoadedSpan.firstChild;
						imgLoadedSpan.style = '';
						
						messageList.media.addDragToResizeListener(img);
					}
				}
			}
		}),
		
		imageDataArray: [],		
		shouldDrag: false,
		lastResized: undefined,		
		
		initDragToResize: function() {
			
			document.body.addEventListener('mousemove', (evt) => {						
				if (this.shouldDrag && evt.target.isEqualNode(this.lastResized)) {
					
					if (evt.clientX < evt.target.getBoundingClientRect().left) {				
						this.shouldDrag = false;
						return;
					}
					
					var imageData = this.imageDataArray[evt.target.getAttribute('image_index')];

					var width = evt.target.width;
					var height = evt.target.height;
					
					if (width && height) {
						
						var offsetX = evt.clientX - imageData.startX;
						var offsetY = evt.clientY - imageData.startY;		
						var average = (offsetX + offsetY) / 2;
						var offset;
						
						if (offsetX > 0 || offsetY > 0) {
							offset = Math.max(offsetX, offsetY, average);
						}
						else if (offsetX < 0 || offset < 0) {
							offset = Math.min(offsetX, offsetY, average);
						}
						else {
							return;
						}

						var newWidth = width + offset;
										
						if (newWidth >= imageData.minWidth) {							
							var ratio = newWidth / width;
							var newHeight = Math.round(height * ratio);
							
							if (newHeight >= imageData.minHeight) {					
								evt.target.width = newWidth;
								evt.target.height = newHeight;

								imageData.startX = evt.clientX;
								imageData.startY = evt.clientY;								
							}
						}
					}
				}
			});

			// For some reason, the height property doesn't increase correctly after being decreased (???)
			// It's not noticeable because of the height: "auto" CSS rule, but it makes further resizing
			// impossible as height is always < the minHeight value. We can fix this using getBoundingClientRect()
			// to get the real height and make sure it's accurate. It won't have too much of a performance impact
			// if we do it after the mouseup event fires
			
			document.body.addEventListener('mouseup', (evt) => {			
				
				if (this.lastResized 
						&& this.lastResized.height < this.lastResized.getBoundingClientRect().height) {
							
					this.lastResized.height = this.lastResized.getBoundingClientRect().height;
				}
				
				this.shouldDrag = false;
			});
			
		},
		
		addDragToResizeListener: function(element) {
			var minWidth = Math.min(100, element.width);
			var minHeight = element.height * (minWidth / element.width);				
				
			// Expanded thumbnails don't appear to have width/height property, which prevents us from
			// being able to resize them. We can fix this by using getBoundingClientRect() to get the 
			// actual size of the image
			if (!element.width || !element.height) {
				element.width = element.getBoundingClientRect().width;
				element.height = element.getBoundingClientRect().height;
			}
			
			element.setAttribute('image_index', this.imageDataArray.length);
			
			this.imageDataArray.push({
				minWidth: minWidth,
				minHeight: minHeight,
				originalWidth: element.width,
				originalHeight: element.height,
				startX: 0,
				startY: 0
			});			
			
			// We initiate the drag event when mousedown fires on the element,
			// and cancel it once mouseup fires on document.body
			element.addEventListener('mousedown', (evt) => {
				if (evt.target.parentNode.className === 'img-loaded' && !evt.shiftKey) {
					return;
				}
				
				var imageData = this.imageDataArray[evt.target.getAttribute('image_index')];								
				imageData.startX = evt.clientX;
				imageData.startY = evt.clientY;
				
				this.lastResized = evt.target;
				
				this.shouldDrag = true;
			});		
			
			// Reset to original size on doubleclick
			element.addEventListener('dblclick', (evt) => {
				var imageData = this.imageDataArray[evt.target.getAttribute('image_index')];
				element.width = imageData.originalWidth;
				element.height = imageData.originalHeight;
			});
			
			// Cancel default event if dragstart fires and user is holding shift key
			element.addEventListener('dragstart', (evt) => {
				if (evt.target.parentNode.className === 'img-loaded' && !evt.shiftKey) {
					return;
				}
				
				evt.preventDefault();
			});						
		}
	},
	
	spoilers: {
		find: function(el) {
			var spans = document.getElementsByClassName('spoiler_on_close');
			var node;
			for (var i = 0; spans[i]; i++) {
				node = spans[i].getElementsByTagName('a')[0];
				messageList.spoilers.toggle(node);
			}
		},
		
		toggle: function(element) {	
			while (!/spoiler_(?:open|close)/.test(element.className)) {				
				element = element.parentNode;				
			}
			
			if (element.className.indexOf('closed') > -1) {
				element.className = element.className.replace('closed', 'opened');
			}
			else {
				element.className = element.className.replace('opened', 'closed');
			}
			
			return false;
		}
	},
	
	links: {
		uniqueIndex: 0, // See https://github.com/sonicmax/ChromeLL-2.0/issues/80
		
		/**
		 *  Iterates over any posted links in topic so we can check for media that should be embedded
		 */
	
		check: function(msg) {
			var dupeCheck = {};
			var mediaToEmbed = false;
			var target = msg || document;						
			
			var links = target.getElementsByClassName('l');
			
			if (links.length == 0) {
				return;
			}
			
			var i = links.length;
			var ytRegex = /youtube|youtu.be/;
			var videoCodeRegex = /^.*(youtu.be\/|v\/|u\/\w\/\/|watch\?v=|\&v=)([^#\&\?]*).*/;
			
			// Iterate backwards to prevent errors when modifying class of elements.
			while (i--) {
				var link = links[i];
				
				// Check for YouTube links and make sure they are videos
				if (messageList.config.embed_on_hover && ytRegex.test(link.href) && videoCodeRegex.test(link.href)) {
					link.className = 'youtube';
					
					// give each video link a unique id for embed/hide functions
					link.id = link.href + '&' + this.uniqueIndex;
					this.uniqueIndex++;
					
					link.addEventListener('mouseenter', messageList.handleEvent.mouseenter.bind(messageList));
					link.addEventListener('mouseleave', messageList.handleEvent.mouseleave.bind(messageList));
				}
				
				// Check for Gfycat links
				else if (messageList.config.embed_gfycat && link.title.indexOf('gfycat.com/') > -1) {
								
					link.classList.add('media', 'gfycat');
					mediaToEmbed = true;
					
					if (messageList.config.embed_gfycat_thumbs || link.parentNode.className == 'quoted-message') {
						link.setAttribute('name', 'gfycat_thumb');
					}
				}
				
				// Check for Imgur links
				else if (messageList.config.embed_imgur && link.title.indexOf('imgur.com/') > -1) {
								
					link.classList.add('media', 'imgur');
					mediaToEmbed = true;

					if (messageList.config.embed_gfycat_thumbs || link.parentNode.className == 'quoted-message') {
						link.setAttribute('name', 'imgur_thumb');
					}					
				}
				
				else if (messageList.config.embed_tweets && link.href.indexOf('twitter.com/') > -1 && link.href.indexOf('status') > -1) {
						
						link.classList.add('media', 'twitter');
						mediaToEmbed = true;
						
						link.id = link.href + '&' + this.uniqueIndex;
						this.uniqueIndex++;	

					// Avoid embedding the same tweet multiple times in the same post, and avoid embedding tweets in quoted messages.
					// The click_embed_tweet class will allow user to manually embed if they desire					
					if (dupeCheck[link.href] || link.parentNode.className == 'quoted-message') {
							link.classList.add('click_embed_tweet');
						}
					
					dupeCheck[link.href] = true;
				}			
				
			}
			
			// Call mediaLoader to embed links which are visible in viewport
			if (mediaToEmbed) {
				messageList.mediaLoader();
				window.addEventListener('scroll', messageList.mediaLoader);
				document.addEventListener('visibilitychange', messageList.mediaPauser);
			}
			
		},
		
		
		/**
		 *  Fixes issue where certain types of relative URL on ETI would redirect to the wrong subdomain.
		 */
		
		fixRelativeUrls: function(anchor, type) {
			switch (type) {
				case 'wiki':
					window.open(anchor.href.replace('boards', 'wiki'));
					break;
				
				case 'imagemap':
					window.open(anchor.href.replace('boards', 'images'));
					break;
				
				case 'archives':
					window.open(anchor.href.replace('boards', 'archives'));
					break;
			}			
		}	
	},
	
	emojis: {
		
		/* Note:
				
				Generally emoji categories correspond to things like smileys, animals, food, etc
				'🔁' displays all emojis saved to config.emoji_history.
				'All' displays all emojis
				
		*/
		
		categories: ['🔁', '😃', '🐻', '🍆', '⚽', '🌇', '💡', '💯', '🚩', 'All'],
		
		addMenu: function() {
			var quickpostBody = document.getElementsByClassName('quickpost-body')[0];
			var emojiMenu = document.createElement('span');			
			emojiMenu.className = 'emoji_button';
			emojiMenu.innerHTML = ' 🙂 ';
			quickpostBody.insertBefore(emojiMenu, quickpostBody.getElementsByTagName('textarea')[0]);
		},
		
		toggleMenu: function(evt) {
			var menu = document.getElementsByClassName('emoji_menu')[0];
			
			if (menu) {
				document.body.removeChild(menu);
			}
			
			else {
				messageList.emojis.openMenu(evt);
			}
		},
		
		openMenu: function(evt) {
			var menu = document.createElement('div');
			var width = window.innerWidth;
			var height = window.innerHeight;
			
			// Create close button
			var close = document.createElement('div');
			close.id = "close_options";
			close.className = 'close';
			
			// Style main div			
			menu.style.width = (width * 0.95) + 'px';
			menu.style.height = (height * 0.4) + 'px';
			menu.style.left = (width - (width * 0.975)) + 'px';
			menu.style.top = (height - (height * 0.975)) + 'px';
			menu.className = "emoji_menu";
			
			var selector = document.createElement('div');
			selector.className = 'emoji_selector';
			
			var selectorList = document.createElement('ul');
			selectorList.className = 'emoji_selector_container';
			selectorList.append(document.createElement('br'));		
			
			for (var i = 0, len = this.categories.length; i < len; i++) {
				var category = this.categories[i];
				var element = document.createElement('li');
				element.innerHTML = category;
				element.id = category;
				element.className = 'emoji_type';
				selectorList.appendChild(element);				
			}
			
			selector.appendChild(selectorList);
			
			var display = document.createElement('div'); 
			display.className = 'emoji_display';
			
			display.appendChild(document.createElement('br'));
			
			menu.appendChild(close);
			menu.appendChild(selector);
			menu.appendChild(display);
			document.body.appendChild(menu);
			
			if (!messageList.config.emoji_history || messageList.config.emoji_history.length < 1) {
				this.displayCategory('😃');	
			}
			
			else {
				this.displayCategory('🔁');
			}
			
			document.body.addEventListener('click', this.menuCloseIntentCheck);			
		},
		
		/**
		 *  Recieves click events on document.body and decides whether to close emoji popup (based on likely user intent)
		 */
		
		menuCloseIntentCheck: function(evt) {
			// Weird edge cases that we should ignore
			if (evt.target.innerHTML === 'Your message must be at least 5 characters'
					|| evt.target.innerHTML === 'Know the rules! Mouse over the tags to learn more.') {						
				return;
			}							
			
			var targetClass = evt.target.className;
			
			// Close popup if user clicks outside of emoji menu, quickpost area, tag info popups,
			// or if user closes quickpost area by clicking on the quickpost-nub
			
			if (targetClass
					&& !/quickpost/.test(targetClass)
					&& !/emoji/.test(targetClass)
					&& !/tag/.test(targetClass)
					
					|| targetClass === 'quickpost-nub'
					|| targetClass === 'close') {							
											
				messageList.emojis.closeMenuFromListener();
				return;
			}
			
			var parent = evt.target.parentNode;			
			
			if (parent) {
				var parentClass = evt.target.parentNode.className;
			
				if (parentClass
						&& !/quickpost/.test(parentClass)
						&& !/emoji/.test(parentClass)
						&& !/tag/.test(parentClass)) {
						
					messageList.emojis.closeMenuFromListener();
					return;
				}
			}
			
			// Close popup if user clicks Post Message button			
			if (evt.target.getAttribute('name') === 'post') {
				messageList.emojis.closeMenuFromListener();
				return;
			}
			
			// Just remove the listener if user clicks on button which opens popup - toggleMenu() is called elsewhere
			if (targetClass === 'emoji_button') {				
				document.body.removeEventListener('click', messageList.emojis.menuCloseIntentCheck);
				return;
			}	
		},
		
		closeMenuFromListener: function() {
			document.body.removeEventListener('click', messageList.emojis.menuCloseIntentCheck);
			messageList.emojis.toggleMenu();			
		},
		
		selectEmoji: function(evt) {
			var quickreply = document.getElementsByTagName('textarea')[0];			
			var emoji = evt.target.innerHTML;
			
			// Insert emoji at caret position
			var caret = quickreply.selectionStart;
			
			quickreply.value = quickreply.value.substring(0, caret) 
					+ emoji 
					+ quickreply.value.substring(caret, quickreply.value.length);
			
			// Move caret to end of inserted emoji
			var endOfInsertion = caret + emoji.length;
			
			// We have to call setSelectionRange from inside setTimeout because of weird Chrome bug
			setTimeout(() => {
				quickreply.focus();
				quickreply.setSelectionRange(endOfInsertion, endOfInsertion);				
			}, 0);
			
			if (messageList.config.emoji_history.indexOf(emoji) === -1) {
				messageList.config.emoji_history.push(emoji);
				
				messageList.sendMessage({
					need: "save",
					name: "emoji_history",
					data: messageList.config.emoji_history
				});
			}	
		},
		
		clearHistory: function() {
			messageList.config.emoji_history = [];
			
			messageList.sendMessage({
				need: "save",
				name: "emoji_history",
				data: []
			});
			
			var display = document.getElementsByClassName('emoji_display')[0];
			display.innerHTML = '<br>';
			
			var clear = document.createElement('span');
			clear.innerHTML = 'Clear';
			clear.className = 'clear_emoji_history';
			display.appendChild(clear);			
		},				
		
		switchType: function(evt) {
			var oldSelection = document.getElementsByClassName('selected');
			oldSelection[0].classList.remove('selected');			
			this.displayCategory(evt.target.innerHTML);
		},
		
		displayAll: function() {
			var display = document.getElementsByClassName('emoji_display')[0];
			display.innerHTML = '<br>';
			
			for (var i = 0, len = this.categories.length; i < len; i++) {
				var category = this.categories[i];
				
				if (category !== 'All' && category !== '🔁') {
					var fragment = document.createDocumentFragment();
					var emojis = this.getEmojis(category);								
					
					for (var j = 0, len = emojis.length; j < len; j++) {
						var emoji = emojis[j];
						var element = document.createElement('span');
						element.innerHTML = emoji;
						element.className = 'emoji';
						fragment.appendChild(element);
					}
					
					display.appendChild(fragment);
				}						
			}
		},
		
		displayCategory: function(type) {
			var display = document.getElementsByClassName('emoji_display')[0];
			display.innerHTML = '<br>';
			
			var selectedType = document.getElementById(type);
			selectedType.classList.add('selected');			
			var emojis = this.getEmojis(type);
			var fragment = document.createDocumentFragment();
			for (var i = 0, len = emojis.length; i < len; i++) {
				var emoji = emojis[i];
				var element = document.createElement('span');
				element.innerHTML = emoji;
				element.id = emoji;
				element.className = 'emoji';
				fragment.appendChild(element);
			}
			
			if (type === '🔁') {
				var clear = document.createElement('span');
				clear.innerHTML = 'Clear';
				clear.className = 'clear_emoji_history';
				fragment.appendChild(clear);
			}
			
			display.appendChild(fragment);
		},				
		
		/**
		 *  Returns lists of emojis based on categories scraped from emojipedia.org
		 */
		
		getEmojis: function(type) {
			switch (type) {				
				case '🔁':
					return messageList.config.emoji_history;
				
				case '😃': 
					return ["😀", "😁", "😂", "🤣", "😃", "😄", "😅", "😆", "😉", "😊", "😋", "😎", "😍", "😘", "😗", "😙", "😚", "☺", "🙂", "🤗", "🤔", "😐", "😑", "😶", "🙄", "😏", "😣", "😥", "😮", "🤐", "😯", "😪", "😫", "😴", "😌", "🤓", "😛", "😜", "😝", "🤤", "😒", "😓", "😔", "😕", "🙃", "🤑", "😲", "☹", "🙁", "😖", "😞", "😟", "😤", "😢", "😭", "😦", "😧", "😨", "😩", "😬", "😰", "😱", "😳", "😵", "😡", "😠", "😇", "🤠", "🤡", "🤥", "😷", "🤒", "🤕", "🤢", "🤧", "😈", "👿", "👹", "👺", "💀", "👻", "👽", "🤖", "💩", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "👦", "👧", "👨", "👩", "👴", "👵", "👶", "👼", "👮", "🕵", "💂", "👷", "👳", "👱", "🎅", "🤶", "👸", "🤴", "👰", "🤰", "👲", "🙍", "🙎", "🙅", "🙆", "💁", "🙋", "🙇", "💆", "💇", "🚶", "🏃", "💃", "🕺", "👯", "🕴", "🗣", "👤", "👥", "👫", "👬", "👭", "💏", "👨‍❤️‍💋‍👨", "👩‍❤️‍💋‍👩", "💑", "👨‍❤️‍👨", "👩‍❤️‍👩", "👪", "👨‍👩‍👦", "👨‍👩‍👧", "👨‍👩‍👧‍👦", "👨‍👩‍👦‍👦", "👨‍👩‍👧‍👧", "👨‍👨‍👦", "👨‍👨‍👧", "👨‍👨‍👧‍👦", "👨‍👨‍👦‍👦", "👨‍👨‍👧‍👧", "👩‍👩‍👦", "👩‍👩‍👧", "👩‍👩‍👧‍👦", "👩‍👩‍👦‍👦", "👩‍👩‍👧‍👧", "👨‍👦", "👨‍👦‍👦", "👨‍👧", "👨‍👧‍👦", "👨‍👧‍👧", "👩‍👦", "👩‍👦‍👦", "👩‍👧", "👩‍👧‍👦", "👩‍👧‍👧", "💪", "🤳", "👈", "👉", "☝", "👆", "🖕", "👇", "✌", "🤞", "🖖", "🤘", "🖐", "✋", "👌", "👍", "👎", "✊", "👊", "🤛", "🤜", "🤚", "👋", "👏", "✍", "👐", "🙌", "🙏", "🤝", "💅", "👂", "👃", "👣", "👀", "👁", "👅", "👄", "💋", "👓", "🕶", "👔", "👕", "👖", "👗", "👘", "👙", "👚", "👛", "👜", "👝", "🎒", "👞", "👟", "👠", "👡", "👢", "👑", "👒", "🎩", "🎓", "⛑", "💄", "💍", "🌂", "☂", "💼"];
					
				case '🐻':
					return ["🙈", "🙉", "🙊", "💥", "💦", "💨", "💫", "🐵", "🐒", "🦍", "🐶", "🐕", "🐩", "🐺", "🦊", "🐱", "🐈", "🦁", "🐯", "🐅", "🐆", "🐴", "🐎", "🦄", "🐮", "🐂", "🐃", "🐄", "🐷", "🐖", "🐗", "🐽", "🐏", "🐑", "🐐", "🐪", "🐫", "🐘", "🦏", "🐭", "🐁", "🐀", "🐹", "🐰", "🐇", "🐿", "🦇", "🐻", "🐨", "🐼", "🐾", "🦃", "🐔", "🐓", "🐣", "🐤", "🐥", "🐦", "🐧", "🕊", "🦅", "🦆", "🦉", "🐸", "🐊", "🐢", "🦎", "🐍", "🐲", "🐉", "🐳", "🐋", "🐬", "🐟", "🐠", "🐡", "🐙", "🐚", "🦀", "🦐", "🦑", "🦋", "🐌", "🐛", "🐜", "🐝", "🐞", "🕷", "🕸", "🦂", "💐", "🌸", "💮", "🏵", "🌹", "🥀", "🌺", "🌻", "🌼", "🌷", "🌱", "🌲", "🌳", "🌴", "🌵", "🌾", "🌿", "☘", "🍀", "🍁", "🍂", "🍃", "🍄", "🌰", "🌍", "🌎", "🌏", "🌐", "🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘", "🌙", "🌚", "🌛", "🌜", "☀", "🌝", "🌞", "⭐", "🌟", "🌠", "☁", "⛅", "⛈", "🌤", "🌥", "🌦", "🌧", "🌨", "🌩", "🌪", "🌫", "🌬", "🌈", "☂", "☔", "⚡", "❄", "☃", "⛄", "☄", "🔥", "💧", "🌊", "🎄", "✨", "🎋", "🎍"];
				
				case '🍆':
					return ["🍇", "🍈", "🍉", "🍊", "🍋", "🍌", "🍍", "🍎", "🍏", "🍐", "🍑", "🍒", "🍓", "🥝", "🍅", "🥑", "🍆", "🥔", "🥕", "🌽", "🌶", "🥒", "🍄", "🥜", "🌰", "🍞", "🥐", "🥖", "🥞", "🧀", "🍖", "🍗", "🍔", "🍟", "🍕", "🌭", "🌮", "🌯", "🍳", "🍲", "🥗", "🍿", "🍱", "🍘", "🍙", "🍚", "🍛", "🍜", "🍝", "🍠", "🍢", "🍣", "🍤", "🍥", "🍡", "🍦", "🍧", "🍨", "🍩", "🍪", "🎂", "🍰", "🍫", "🍬", "🍭", "🍮", "🍯", "🍼", "🥛", "☕", "🍵", "🍶", "🍾", "🍷", "🍸", "🍹", "🍺", "🍻", "🥂", "🥃", "🍽", "🍴", "🥄"];
				
				case '⚽':
					return ["👾", "🕴", "🎪", "🎭", "🎨", "🎰", "🎗", "🎟", "🎫", "🎖", "🏆", "🏅", "🥇", "🥈", "🥉", "⚽", "⚾", "🏀", "🏐", "🏈", "🏉", "🎾", "🎱", "🎳", "🏏", "🏑", "🏒", "🏓", "🏸", "🥊", "🥋", "🎯", "⛳", "⛸", "🎣", "🎽", "🎿", "🏇", "⛷", "🏂", "🏌", "🏄", "🚣", "🏊", "⛹", "🏋", "🚴", "🚵", "🤸", "🤼", "🤽", "🤾", "🤹", "🎮", "🎲", "🎼", "🎤", "🎧", "🎷", "🎸", "🎹", "🎺", "🎻", "🥁", "🎬", "🏹"];
					
				case '🌇':
					return ["🗾", "🏔", "⛰", "🌋", "🗻", "🏕", "🏖", "🏜", "🏝", "🏞", "🏟", "🏛", "🏗", "🏘", "🏙", "🏚", "🏠", "🏡", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "🏪", "🏫", "🏬", "🏭", "🏯", "🏰", "💒", "🗼", "🗽", "⛪", "🕌", "🕍", "⛩", "🕋", "⛲", "⛺", "🌁", "🌃", "🌄", "🌅", "🌆", "🌇", "🌉", "🌌", "🎠", "🎡", "🎢", "🚂", "🚃", "🚄", "🚅", "🚆", "🚇", "🚈", "🚉", "🚊", "🚝", "🚞", "🚋", "🚌", "🚍", "🚎", "🚐", "🚑", "🚒", "🚓", "🚔", "🚕", "🚖", "🚗", "🚘", "🚚", "🚛", "🚜", "🚲", "🛴", "🛵", "🏎", "🏍", "🚏", "🛤", "⛽", "🚨", "🚥", "🚦", "🚧", "⚓", "⛵", "🚤", "🛳", "⛴", "🛥", "🚢", "✈", "🛩", "🛫", "🛬", "💺", "🚁", "🚟", "🚠", "🚡", "🚀", "🛰", "🌠", "⛱", "🎆", "🎇", "🎑", "🚣", "💴", "💵", "💶", "💷", "🗿", "🛂", "🛃", "🛄", "🛅"];
					
				case '💡':
					return ["☠", "💌", "💣", "🕳", "🛍", "📿", "💎", "🔪", "🏺", "🗺", "💈", "🖼", "🛎", "🚪", "🛌", "🛏", "🛋", "🚽", "🚿", "🛀", "🛁", "⌛", "⏳", "⌚", "⏰", "⏱", "⏲", "🕰", "🌡", "⛱", "🎈", "🎉", "🎊", "🎎", "🎏", "🎐", "🎀", "🎁", "🕹", "📯", "🎙", "🎚", "🎛", "📻", "📱", "📲", "☎", "📞", "📟", "📠", "🔋", "🔌", "💻", "🖥", "🖨", "⌨", "🖱", "🖲", "💽", "💾", "💿", "📀", "🎥", "🎞", "📽", "📺", "📷", "📸", "📹", "📼", "🔍", "🔎", "🔬", "🔭", "📡", "🕯", "💡", "🔦", "🏮", "📔", "📕", "📖", "📗", "📘", "📙", "📚", "📓", "📃", "📜", "📄", "📰", "🗞", "📑", "🔖", "🏷", "💰", "💴", "💵", "💶", "💷", "💸", "💳", "✉", "📧", "📨", "📩", "📤", "📥", "📦", "📫", "📪", "📬", "📭", "📮", "🗳", "✏", "✒", "🖋", "🖊", "🖌", "🖍", "📝", "📁", "📂", "🗂", "📅", "📆", "🗒", "🗓", "📇", "📈", "📉", "📊", "📋", "📌", "📍", "📎", "🖇", "📏", "📐", "✂", "🗃", "🗄", "🗑", "🔒", "🔓", "🔏", "🔐", "🔑", "🗝", "🔨", "⛏", "⚒", "🛠", "🗡", "⚔", "🔫", "🛡", "🔧", "🔩", "⚙", "🗜", "⚗", "⚖", "🔗", "⛓", "💉", "💊", "🚬", "⚰", "⚱", "🗿", "🛢", "🔮", "🚰", "🏁", "🚩", "🎌", "🏴", "🏳", "🏳️‍🌈"];
					
				case '💯':
					return ["💘", "❤", "💓", "💔", "💕", "💖", "💗", "💙", "💚", "💛", "💜", "🖤", "💝", "💞", "💟", "❣", "💤", "💢", "💬", "🗯", "💭", "💮", "♨", "💈", "🛑", "🕛", "🕧", "🕐", "🕜", "🕑", "🕝", "🕒", "🕞", "🕓", "🕟", "🕔", "🕠", "🕕", "🕡", "🕖", "🕢", "🕗", "🕣", "🕘", "🕤", "🕙", "🕥", "🕚", "🕦", "🌀", "♠", "♥", "♦", "♣", "🃏", "🀄", "🎴", "🔇", "🔈", "🔉", "🔊", "📢", "📣", "📯", "🔔", "🔕", "🎵", "🎶", "🏧", "🚮", "🚰", "♿", "🚹", "🚺", "🚻", "🚼", "🚾", "⚠", "🚸", "⛔", "🚫", "🚳", "🚭", "🚯", "🚱", "🚷", "🔞", "☢", "☣", "⬆", "↗", "➡", "↘", "⬇", "↙", "⬅", "↖", "↕", "↔", "↩", "↪", "⤴", "⤵", "🔃", "🔄", "🔙", "🔚", "🔛", "🔜", "🔝", "🛐", "⚛", "🕉", "✡", "☸", "☯", "✝", "☦", "☪", "☮", "🕎", "🔯", "♻", "📛", "🔰", "🔱", "⭕", "✅", "☑", "✔", "✖", "❌", "❎", "➕", "➖", "➗", "➰", "➿", "〽", "✳", "✴", "❇", "‼", "⁉", "❓", "❔", "❕", "❗", "©", "®", "™", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓", "⛎", "🔀", "🔁", "🔂", "▶", "⏩", "◀", "⏪", "🔼", "⏫", "🔽", "⏬", "⏹", "🎦", "🔅", "🔆", "📶", "📳", "📴", "#️⃣", "0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "💯", "🔠", "🔡", "🔢", "🔣", "🔤", "🅰", "🆎", "🅱", "🆑", "🆒", "🆓", "ℹ", "🆔", "Ⓜ", "🆕", "🆖", "🅾", "🆗", "🅿", "🆘", "🆙", "🆚", "🈁", "🈂", "🈷", "🈶", "🈯", "🉐", "🈹", "🈚", "🈲", "🉑", "🈸", "🈴", "🈳", "㊗", "㊙", "🈺", "🈵", "▪", "▫", "◻", "◼", "◽", "◾", "⬛", "⬜", "🔶", "🔷", "🔸", "🔹", "🔺", "🔻", "💠", "🔲", "🔳", "⚪", "⚫", "🔴", "🔵", "👁‍🗨"];
					
				case '🚩':
					return ["🏁", "🚩", "🎌", "🏴", "🏳", "🏳️‍🌈", "🇦🇨", "🇦🇩", "🇦🇪", "🇦🇫", "🇦🇬", "🇦🇮", "🇦🇱", "🇦🇲", "🇦🇴", "🇦🇶", "🇦🇷", "🇦🇸", "🇦🇹", "🇦🇺", "🇦🇼", "🇦🇽", "🇦🇿", "🇧🇦", "🇧🇧", "🇧🇩", "🇧🇪", "🇧🇫", "🇧🇬", "🇧🇭", "🇧🇮", "🇧🇯", "🇧🇱", "🇧🇲", "🇧🇳", "🇧🇴", "🇧🇶", "🇧🇷", "🇧🇸", "🇧🇹", "🇧🇻", "🇧🇼", "🇧🇾", "🇧🇿", "🇨🇦", "🇨🇨", "🇨🇩", "🇨🇫", "🇨🇬", "🇨🇭", "🇨🇮", "🇨🇰", "🇨🇱", "🇨🇲", "🇨🇳", "🇨🇴", "🇨🇵", "🇨🇷", "🇨🇺", "🇨🇻", "🇨🇼", "🇨🇽", "🇨🇾", "🇨🇿", "🇩🇪", "🇩🇬", "🇩🇯", "🇩🇰", "🇩🇲", "🇩🇴", "🇩🇿", "🇪🇦", "🇪🇨", "🇪🇪", "🇪🇬", "🇪🇭", "🇪🇷", "🇪🇸", "🇪🇹", "🇪🇺", "🇫🇮", "🇫🇯", "🇫🇰", "🇫🇲", "🇫🇴", "🇫🇷", "🇬🇦", "🇬🇧", "🇬🇩", "🇬🇪", "🇬🇫", "🇬🇬", "🇬🇭", "🇬🇮", "🇬🇱", "🇬🇲", "🇬🇳", "🇬🇵", "🇬🇶", "🇬🇷", "🇬🇸", "🇬🇹", "🇬🇺", "🇬🇼", "🇬🇾", "🇭🇰", "🇭🇲", "🇭🇳", "🇭🇷", "🇭🇹", "🇭🇺", "🇮🇨", "🇮🇩", "🇮🇪", "🇮🇱", "🇮🇲", "🇮🇳", "🇮🇴", "🇮🇶", "🇮🇷", "🇮🇸", "🇮🇹", "🇯🇪", "🇯🇲", "🇯🇴", "🇯🇵", "🇰🇪", "🇰🇬", "🇰🇭", "🇰🇮", "🇰🇲", "🇰🇳", "🇰🇵", "🇰🇷", "🇰🇼", "🇰🇾", "🇰🇿", "🇱🇦", "🇱🇧", "🇱🇨", "🇱🇮", "🇱🇰", "🇱🇷", "🇱🇸", "🇱🇹", "🇱🇺", "🇱🇻", "🇱🇾", "🇲🇦", "🇲🇨", "🇲🇩", "🇲🇪", "🇲🇫", "🇲🇬", "🇲🇭", "🇲🇰", "🇲🇱", "🇲🇲", "🇲🇳", "🇲🇴", "🇲🇵", "🇲🇶", "🇲🇷", "🇲🇸", "🇲🇹", "🇲🇺", "🇲🇻", "🇲🇼", "🇲🇽", "🇲🇾", "🇲🇿", "🇳🇦", "🇳🇨", "🇳🇪", "🇳🇫", "🇳🇬", "🇳🇮", "🇳🇱", "🇳🇴", "🇳🇵", "🇳🇷", "🇳🇺", "🇳🇿", "🇴🇲", "🇵🇦", "🇵🇪", "🇵🇫", "🇵🇬", "🇵🇭", "🇵🇰", "🇵🇱", "🇵🇲", "🇵🇳", "🇵🇷", "🇵🇸", "🇵🇹", "🇵🇼", "🇵🇾", "🇶🇦", "🇷🇪", "🇷🇴", "🇷🇸", "🇷🇺", "🇷🇼", "🇸🇦", "🇸🇧", "🇸🇨", "🇸🇩", "🇸🇪", "🇸🇬", "🇸🇭", "🇸🇮", "🇸🇯", "🇸🇰", "🇸🇱", "🇸🇲", "🇸🇳", "🇸🇴", "🇸🇷", "🇸🇸", "🇸🇹", "🇸🇻", "🇸🇽", "🇸🇾", "🇸🇿", "🇹🇦", "🇹🇨", "🇹🇩", "🇹🇫", "🇹🇬", "🇹🇭", "🇹🇯", "🇹🇰", "🇹🇱", "🇹🇲", "🇹🇳", "🇹🇴", "🇹🇷", "🇹🇹", "🇹🇻", "🇹🇼", "🇹🇿", "🇺🇦", "🇺🇬", "🇺🇲", "🇺🇳", "🇺🇸", "🇺🇾", "🇺🇿", "🇻🇦", "🇻🇨", "🇻🇪", "🇻🇬", "🇻🇮", "🇻🇳", "🇻🇺", "🇼🇫", "🇼🇸", "🇽🇰", "🇾🇪", "🇾🇹", "🇿🇦", "🇿🇲", "🇿🇼", "🏴‍☠️", "🇽🇼", "🇽🇸", "🇽🇪"];
					
				case 'All':
					this.displayAll();
			}
		}
	},
	
	tcs: {
		getTopicCreator: function() {				
			var params = new URLSearchParams(window.location.search);
			var topic = params.get("topic");
			var creator;
			
			if (messageList.config.tcs[topic]) {
				return messageList.config.tcs[topic].tc;
					}
			
			else {
				if (params.has("u")) {
					// Ignore filtered user view when caching topic creator.
					return;
				}
				
				var tops = document.getElementsByClassName('message-top');									
								
				if (messageList.tags.includes('Anonymous')) {
					creator = "human #1";
			}
				
				else if ((!params.has("page") || params.get("page") == 1)) {
					creator = tops[0].getElementsByTagName('a')[0].innerHTML.toLowerCase();
				}
				
				else {
					return;
				}
				
				messageList.config.tcs[topic] = {};
				messageList.config.tcs[topic].tc = creator;
				messageList.config.tcs[topic].date = new Date().getTime();
				this.save();

				return creator;					
			}
		},
		
		save: function() {
			var max = 40;
			var lowest = Infinity;
			var lowestTc;
			var numTcs = 0;
			
			for (var i in messageList.config.tcs) {
				if (messageList.config.tcs[i].date < lowest) {
					lowestTc = i;
					lowest = messageList.config.tcs[i].date;
				}
				numTcs++;
			}
			
			if (numTcs > max) {
				delete messageList.config.tcs[lowestTc];
			}
				
				messageList.sendMessage({
					need: "save",
					name: "tcs",
					data: messageList.config.tcs
				});
			}
	},
	
	likeButton: {
		
		buildText: function(likeButtonElement, templateNumber) {
			var anonymous;
			var container = likeButtonElement.parentNode.parentNode;
			var message = likeButtonElement.parentNode.parentNode.getElementsByClassName('message')[0];
			var nub = document.getElementsByClassName('quickpost-nub')[0];
			var quickreply = document.getElementsByTagName('textarea')[0];
			
			
			// Get names of user and quoted poster
			if (messageList.tags.includes('Anonymous')) {
				anonymous = true;
				var user = "Human";
				var poster = "this";
			}
			
			else {
				var user = document.getElementsByClassName('userbar')[0]
						.getElementsByTagName('a')[0].innerHTML.replace(/ \((-?\d+)\)$/, "");
				var poster = container.getElementsByTagName('a')[0].innerHTML;
			}
			
			
			// Create like message
			var likeMessage;
			if (templateNumber) {
				likeMessage = messageList.config.custom_like_data[templateNumber].contents;
				likeMessage = likeMessage.replace('[user]', user);
				likeMessage = likeMessage.replace('[poster]', poster);
				
				if (anonymous) {
					// Kludgy grammar fix
					likeMessage = likeMessage.replace("this's", "this");
				}
			}
			
			else {				
				var img = '<img src="http://i4.endoftheinter.net/i/n/f818de60196ad15c888b7f2140a77744/like.png" />';
				if (anonymous) {
					likeMessage = img + ' Human likes this post';
				}
				else {
					likeMessage = img + ' ' + user + ' likes ' + poster + "'s post"; 
				}
			}
			
			// Generate markup from selected post and format text to insert
			var msgId = message.getAttribute('msgid');
			var markup = '<quote msgid="' + msgId + '">' + messageList.markupBuilder.build(message) + '</quote>';
			var textToInsert = markup + '\n' + likeMessage;
			
			allPages.insertIntoTextarea(textToInsert);
			
			if (document.getElementsByClassName('regular quickpost-expanded').length == 0) {
				// quickpost area is hidden - click nub element to open
				nub.click();
			}
		},
		
		showOptions: function() {
			if (!document.getElementById('hold_menu')) {
				var likeData = messageList.config.custom_like_data;
				var menuElement = document.createElement('span');
				menuElement.id = 'hold_menu';	
				menuElement.style.position = 'absolute';
				menuElement.style.overflow = 'auto';
				menuElement.style.padding = '3px 3px';
				menuElement.style.borderStyle = 'solid';
				menuElement.style.borderWidth = '2px';
				menuElement.style.borderRadius = '3px';
				menuElement.style.backgroundColor = window.getComputedStyle(document.body).backgroundColor;
				for (var id in likeData) {
					var name = likeData[id].name;					
					populateMenu.call(this, name, id, menuElement);
				}
				messageList.cachedEvent.target.appendChild(menuElement);
			}
			
			function populateMenu(item, id, menuElement) {
				var menuSpan = document.createElement('span');
				var menuItem = document.createElement('anchor');
				var lineBreak = document.createElement('br');
				menuSpan.className = 'unhigh_span';
				menuItem.id = id;
				menuItem.innerHTML = '&nbsp' + item + '&nbsp';
				menuItem.href = '#like_custom_' + id;
				menuItem.className = 'like_button_custom';
				menuSpan.appendChild(menuItem);
				menuElement.appendChild(menuSpan);
				menuElement.appendChild(lineBreak);
			}
		},
		
		hideOptions: function() {
			var menu = document.getElementById('hold_menu');
			if (menu) {
				menu.remove();
			}
		}
	},
	
	archiveQuotes: {
		addQuoteElements: function() {
			var hostname = window.location.hostname;
			var topicId = window.location.search.replace("?topic=", "");
			var container;
			var tops = [];
			var links = document.getElementsByTagName("a");
			var msgs = document.getElementsByClassName("message");
			var containers = document.getElementsByClassName("message-container");
			for (var i = 0, len = containers.length; i < len; i++) {
				var container = containers[i];
				tops[i] = container.getElementsByClassName("message-top")[0];
				var msgID = msgs[i].getAttribute("msgid");
				var quote = document.createElement("a");
				var quoteText = document.createTextNode("Quote");
				var space = document.createTextNode(" | ");
				quote.appendChild(quoteText);
				quote.href = "#";
				quote.id = msgID;
				quote.className = "archivequote";
				tops[i].appendChild(space);
				tops[i].appendChild(quote);
			}
		},		
		
		handler: function(evt) {
			var msgId = evt.target.id;
			var messageContainer = document.querySelector('[msgid="' + msgId + '"]');
			var markup = '<quote msgid="' + msgId + '">' + messageList.markupBuilder.build(messageContainer) + '</quote>';					
			
			// Send markup to background page to be copied to clipboard				
			messageList.sendMessage({
				need: "copy",
				data: markup
			});
			
			this.showNotification(evt.target);
		},
		
		showNotification: function(node) {
			// Create hidden notification so we can use fadeIn() later
			var span = document.createElement('span');
			span.id = 'copied';
			span.style.display = 'none';
			span.style.position = 'absolute';
			span.style.zIndex = 1;
			span.style.left = 100;
			span.style.backgroundColor = window.getComputedStyle(node.parentNode).backgroundColor;
			span.style.fontWeight = 'bold';
			span.innerHTML = '&nbsp[copied to clipboard]';
			
			node.appendChild(span);
						
			$("#copied").fadeIn(200);
				
			setTimeout(() => {
				
				$(node).find("span:last")
						.fadeOut(400);
						
			}, 1500);
			
			setTimeout(() => {
				
				node.removeChild(span);				
						
			}, 2000);
		}		
	},
	
	
	/**
	 *  Makes sure that we only autoscroll if user is already at bottom of page 
	 *  (ie has finished reading current page and is waiting for new posts)
	 */
	
	autoscrollCheck: function(mutation) {
		// checks whether user has scrolled to bottom of page
		var position = mutation.getBoundingClientRect();
		if (mutation.style.display == 'none'
				|| position.top > window.innerHeight) {
			return false;
		} else {
			return true;
		}
	},
	
	startBatchUpload: function(evt) {
		var chosen = document.getElementById('batch_uploads');
		
		if (chosen.files.length == 0) {
			alert('Select files and then click "Batch Upload"');
			return;
		}
		
		for (var i = 0, len = chosen.files.length; i < len; i++) {
			allPages.asyncUploadHandler(chosen.files[i], (output) => {				
				allPages.insertIntoTextarea(output);				
			})
		}	
	},
	
	postTemplateAction: function(evt) {
		if (evt.className === "expand_post_template") {
			var ins = evt.parentNode;
			ins.removeChild(evt);
			var ia = document.createElement('a');
			ia.innerHTML = "&lt;"
			ia.className = "shrink_post_template";
			ia.href = '##';
			ins.innerHTML = '[';
			ins.insertBefore(ia, null);
			for ( var i in this.config.post_template_data) {
				var title = document.createElement('a');
				title.href = '##' + i;
				title.className = 'post_template_title';
				title.innerHTML = i;
				var titleS = document.createElement('span');
				titleS.style.paddingLeft = '3px';
				titleS.innerHTML = '[';
				titleS.insertBefore(title, null);
				titleS.innerHTML += ']';
				titleS.className = i;
				ins.insertBefore(titleS, null);
			}
			ins.innerHTML += ']';
		}
		if (evt.className === "shrink_post_template") {
			var ins = evt.parentNode;
			evt.parentNode.removeChild(evt);
			var ia = document.createElement('a');
			ia.innerHTML = "&gt;"
			ia.className = "expand_post_template";
			ia.href = '##';
			ins.innerHTML = '[';
			ins.insertBefore(ia, null);
			ins.innerHTML += ']';
		}
		if (evt.className === "post_template_title") {
			evt.id = 'post_action';
			var cdiv = document.getElementById('cdiv');
			var d = {};
			d.text = this.config.post_template_data[evt.parentNode.className].text;
			cdiv.innerHTML = JSON.stringify(d);
			cdiv.dispatchEvent(this.postEvent);
		}
	},	
	
	clearUnreadPostsFromTitle: function(evt) {
		if (!/\(\d+\+?\)/.test(document.title)
				|| this.autoscrolling == true
				|| document.hidden) {
			// do nothing
			return;
		}
		
		else if (/\(\d+\+?\)/.test(document.title)) {
			var newTitle = document.title.replace(/\(\d+\+?\) /, "");
			document.title = newTitle;
		}
	},
	
	
	/**
	 *  Handles quickpost HTML tag button events
	 */
	 
	qpTagButton: function(e) {
		if (e.target.tagName != 'INPUT') {
			return 0;
		}
		// from foxlinks
		var tag = e.target.id;
		var open = new RegExp("\\*", "m");
		var ta = document.getElementsByName('message')[0];
		var st = ta.scrollTop;
		var before = ta.value.substring(0, ta.selectionStart);
		var after = ta.value.substring(ta.selectionEnd, ta.value.length);
		var select = ta.value.substring(ta.selectionStart, ta.selectionEnd);

		if (ta.selectionStart == ta.selectionEnd) {
			if (open.test(e.target.value)) {
				e.target.value = e.target.name;
				var focusPoint = ta.selectionStart + tag.length + 3;
				ta.value = before + "</" + tag + ">" + after;
			} else {
				e.target.value = e.target.name + "*";
				var focusPoint = ta.selectionStart + tag.length + 2;
				ta.value = before + "<" + tag + ">" + after;
			}

			ta.selectionStart = focusPoint;
		} else {
			var focusPoint = ta.selectionStart + (tag.length * 2)
					+ select.length + 5;
			ta.value = before + "<" + tag + ">" + select + "</" + tag + ">"
					+ after;
			ta.selectionStart = before.length;
		}

		ta.selectionEnd = focusPoint;
		ta.scrollTop = st;
		ta.focus();
	},
	
	
	/**
	 *  Add event listeners required for ChromeLL features to work
	 */
	
	addListeners: function(message) {
		// make sure that these listeners are only added once
		if (!message) {
			document.body.addEventListener('click', this.handleEvent.mouseclick.bind(this));
			
			var searchBox = document.getElementById('image_search');			
			if (searchBox) {	
				document.addEventListener('keydown', this.handleEvent.keydown.bind(this));
			}
			
			this.media.initDragToResize();
		}
		// these listeners should be added to every new post
		if (this.config.user_info_popup) {
			var tops;
			if (message) {
				tops = message.getElementsByClassName('message-top');
			} else {
				tops = document.getElementsByClassName('message-top');
			}
			for (var i = 0, len = tops.length; i < len; i++) {
				var top = tops[i];				
				var anchor = top.getElementsByTagName('a')[0];
				// ignore users in anon topics
				if (anchor.href.indexOf('endoftheinter.net/profile.php?user=') > -1) {
					anchor.className = 'username_anchor';
					anchor.addEventListener('mouseenter', this.handleEvent.mouseenter.bind(this));
					anchor.addEventListener('mouseleave', this.handleEvent.mouseleave.bind(this));
				}
			}
		}		
	},
	
	appendScripts: function() {
		// TODO: there's really no reason that this has to be loaded from an external script
		var head = document.getElementsByTagName("head")[0];
		if (messageList.config.post_templates) {
			var templates = document.createElement('script');
			templates.type = 'text/javascript';
			templates.src = chrome.extension.getURL('src/js/topicPostTemplate.js');
			head.appendChild(templates);
		}
	},
	
	
	/**
	 *  Used to communicate with background page.
	 */
	
	sendMessage: function(message, callback) {
		
		try {		
			chrome.runtime.sendMessage(message, callback);
		} catch (e) {
			// Maybe there was an error in background page, or extension was updated and 
			// user hasn't refreshed page yet. We can't really do anything but log the error
			console.log('Error while sending message to background page:', message, e);
		}
		
	},
	
	
	/**
	 *  Creates a MutationObserver which observes topic and notifies user if a new page is created
	 */	 
	
	newPageObserver: new MutationObserver((mutations) => {
		for (var i = 0, len = mutations.length; i < len; i++) {
			var mutation = mutations[i];
			
			if (mutation.type === 'attributes' 
					&& mutation.target.style.display === 'block') {
				
				messageList.sendMessage({
					need: "notify",
					title: "New Page Created",
					message: document.title					
					
				});
			}
		}
	}),
	
	
	/**
	 *  Creates a MutationObserver which observes page for new livelinks posts and passes them to handler
	 */
	
	livelinksObserver: new MutationObserver((mutations) => {
		for (var i = 0, len = mutations.length; i < len; i++) {
			var mutation = mutations[i];
			if (mutation.addedNodes.length > 0
					&& mutation.addedNodes[0].childNodes.length > 0) {
				if (mutation.addedNodes[0].childNodes[0].className == 'message-container') {
					// send new message container to livelinks method
					messageList.handleEvent.newPost.call(messageList, mutation.addedNodes[0]);
				}
			}
		}
	}),
	
	
	/**
	 *  Crude method to detect zoom level for image resizing - we don't need to be completely accurate
	 */
	 
	getZoomLevel: function() {
		var screenWidth = window.screen.width;
		var documentWidth = document.documentElement.clientWidth;
		this.zoomLevel = screenWidth / documentWidth;
	},
	
	
	/**
	 *  Converts ignorator string to array and removes any whitelisted users
	 */
	
	prepareIgnoratorArray: function() {
		this.ignoredUsers = this.config.ignorator_list.split(',').map((user) => {
			return user.trim();
		});
		
		if (this.config.ignorator_allow_posts && this.config.ignorator_post_whitelist) {
			
			var whitelist = this.config.ignorator_post_whitelist.split(',').map((user) => {
				return user.trim().toLowerCase(); 
			});
			
			this.ignoredUsers = this.ignoredUsers.filter((user) => {
				return (whitelist.indexOf(user.toLowerCase()) === -1);				
			});
		}
	},
	
	appendDramalinksTicker: function() {
		var titleElement = document.getElementsByTagName('h2')[0];
		dramalinks.appendTo(titleElement);
		
		// Modify existing margin-top value (-39px) of pascal so that it appears above ticker
		var offset = -39 - document.getElementById('dramalinks_ticker').getBoundingClientRect().height;
		
		var sheet = document.createElement('style');
		var selector = 'img[src="//static.endoftheinter.net/pascal.png"]';		
		var rule = "margin-top: " + offset + "px !important";	
		sheet.innerHTML = selector + ' { ' + rule + ' }';
		document.head.appendChild(sheet);
	},
	
	/**
	 *  Adds custom style for [Serious] warning banner.
	 *  Using an attribute selector and appending to document.head before DOMContentLoaded fires
	 *  ensures that the custom colours are applied before the original colours are rendered.
	 */
	
	addCustomSeriousStyle: function() {
		var node = document.createElement('style');
		var selector = 'div[style*="background:#bb2639;color:white;padding:2px 5px;"]';
		
		var rule = 'background-color: #' + this.config.serious_banner_color + ' !important;' 
				+ 'color: #' + this.config.serious_banner_text_color + ' !important;';
		
		node.innerHTML = selector + ', ' + selector + ' a { ' + rule + ' }';
		document.head.appendChild(node);
	},
	
	handleRepliesPage: function() {
		// No infobar on replies page
		this.infobarMethods = {};
		
		// Can't get accurate post count
		delete this.messageContainerMethods.number_posts;		
		
		// Replace newPageObserver.observe() with an empty function
		this.newPageObserver.observe = () => {};
	},
	
	handleArchivedAndLockedTopics: function() {
		this.archiveQuotes.addQuoteElements();
		
		// Delete unusable methods
		delete this.messageContainerMethods.like_button;
		delete this.messageContainerMethods.post_templates;			
	},
	
	addChristmasCss: function() {
		var title = document.getElementsByTagName('h1')[0];
		var christmasClassName;
		
		if (/winter|christmas|xmas|santa|snow|holida[a-z]+/i.test(title.innerHTML)) {
			
			if (/hup hup/i.test(title.innerHTML)) {
				christmasClassName = 'hup_hup';
			}
			else {
				christmasClassName = 'snow';
			}		

			document.body.classList.add(christmasClassName);	
			
			// We need to add some extra styling to prevent snow from being visible in gaps between elements
			var backgroundColor = window.getComputedStyle(document.body).getPropertyValue('background-color');
			document.getElementById('u0_1').style.backgroundColor = backgroundColor;
			
			// Replace the margin with a border which matches the background color of document.body
			document.getElementsByClassName('message-top')[0].style.marginTop = 0;
			document.getElementsByClassName('message-top')[0].style.borderTop = '1px solid ' + backgroundColor;					
			
			var sheet = document.createElement('style');
			var rules = [];
			
			rules.push('div.userbar, div.infobar, #u0_2' + ' {' + 'margin: 0px !important' + '}' + '\n');
			rules.push('div.userbar' + '{' + 'border: 1px solid ' + backgroundColor + '}' + '\n');
			rules.push('div.userbar' + '{' + 'border-bottom: 2px solid ' + backgroundColor + '}' + '\n');
			rules.push('#u0_2' + '{' + 'border-bottom: 1px solid ' + backgroundColor + '}' + '\n');
			rules.push('#u0_3' + '{' + 'border-top: 2px solid ' + backgroundColor + '}' + '\n');
			rules.push('#u0_3' + '{' + 'border-bottom: 1px solid ' + backgroundColor + '}' + '\n');
			rules.push('#u0_4' + '{' + 'border-top: 1px solid ' + backgroundColor + '}' + '\n');
			rules.push('#u0_4' + '{' + 'border-bottom: 2px solid ' + backgroundColor + '}' + '\n');
			
			sheet.innerHTML = rules.join('\n');
			document.head.appendChild(sheet);
			
			// Chrome probably handles this kind of thing automatically, but to be safe we should remove
			// the animation class when tab is not visible to prevent potential performance issues
			
			document.addEventListener('visibilitychange', () => {
					if (document.hidden) {
						document.body.classList.remove(christmasClassName);
					}
					
					else {
						document.body.classList.add(christmasClassName);
					}
				
			});
		}
	},
	
	scrapeTags: function() {
		var tagHeader = document.getElementsByTagName('h2');
		
		if (tagHeader && tagHeader[0] && tagHeader[0].firstChild) {
			var children = tagHeader[0].firstChild.childNodes;
			
			for (var i = 0, len = children.length; i < len; i++) {
				var child = children[i];
				// Child nodes will include anchors and spans - we just want the anchors.
				// Spans are used for tag relationship stuff
				if (child.tagName === 'A') {
					this.tags.push(child.innerHTML);
				}
			}
		}
	},

    /**
	 * Links on your posts to jump right to the Message Edit page
     */
    appendQuickEditLinks: function () {
        let profileUrl = document.querySelector('.userbar a').href;

        for (let messageTop of document.querySelectorAll('.message-top')) {
            if (messageTop.querySelector('a').href === profileUrl) {
                let links = new Array(...messageTop.querySelectorAll('a'));
                let quoteButton = links.filter(a => !!a.innerHTML.match(/^Quote/))[0];
                let editUrl = quoteButton.href.replace(/quote=/, 'id=');
                let divider = document.createElement('span');
                let editLink = document.createElement('a');
                divider.innerHTML = ' | ';
                editLink.innerHTML = 'Edit';
                editLink.href = editUrl;
                messageTop.insertBefore(editLink, quoteButton);
                messageTop.insertBefore(divider, quoteButton);
            }
        }
    },


    /**
	 *  The main loop for this script - called after DOMContentLoaded has fired (or immediately if DOM is ready)
	 *  Applies various types of DOM modifications to the message list, adds listeners for ChromeLL features, etc
	 */
	
	applyDomModifications: function(pm) {
		this.scrapeTags();

		if (this.config.quick_edit) {
			this.appendQuickEditLinks();
		}

		if (this.config.embed_tweets) {
			this.twitter.injectWidgets();
		}
		
		if (this.config.dramalinks && !this.config.hide_dramalinks_topiclist) {
			this.appendDramalinksTicker();
		}
		
		for (var i in this.infobarMethods) {
			if (this.config[i + pm]) {
				this.infobarMethods[i]();
			}
		}
		
		// Check whether user can post in topic
		var topicOpen = (document.getElementsByClassName('quickpost').length > 0);
		
		if (!topicOpen) {
			this.handleArchivedAndLockedTopics();
		}
		
		this.topicCreator = this.tcs.getTopicCreator();

		var msgs = document.getElementsByClassName('message-container');
		
		for (var i = 0, len = msgs.length; i < len; i++) {
			var msg = msgs[i];
			var top = msg.getElementsByClassName('message-top')[0];
			var user = top.getElementsByTagName('a')[0].innerHTML;
			
			for (var k in this.messageContainerMethods) {
				if (this.config[k + pm]) {
					this.messageContainerMethods[k](msg, top, i + 1);					
				}
			}
			
			this.links.check(msg);
		}
		
		// Pass updated ignorator data to background page so we can update badge and popup menu
		if (!this.config.hide_ignorator_badge) {
			this.globalPort.postMessage({
					action: 'ignorator_update',
					ignorator: this.ignorated,
					scope: "messageList"
			});
		}
		
		// Finish modifying visible DOM
		for (var i in this.miscMethods) {
			if (this.config[i + pm]) {
				this.miscMethods[i]();
			}
		}
		
		if (topicOpen) {
			// Call methods which modify quickpost area (user probably won't see this)
			for (var i in this.quickpostMethods) {
				if (this.config[i + pm]) {
					this.quickpostMethods[i]();
				}
			}
			
			// Check whether we need to restore quickpost contents
			if (sessionStorage.getItem('quickpost_value') !== null) {
				var quickpost = document.getElementsByName('message')[0];
				
				quickpost.value = sessionStorage.getItem('quickpost_value');				
				
				setTimeout(() => {
					var caret = sessionStorage.getItem('quickpost_caret_position');
					quickpost.setSelectionRange(caret, caret);
				}, 0);
				
				sessionStorage.removeItem('quickpost_value');
				sessionStorage.removeItem('quickpost_caret_position');
			}
		}
		
		// Check whether we need to restore scroll position
		if (sessionStorage.getItem('scrollx') !== null) {
			window.scrollX = sessionStorage.getItem('scrollx');
			window.scrollY = sessionStorage.getItem('scrolly');
			sessionStorage.removeItem('scrollx');
			sessionStorage.removeItem('scrolly');
		}
					
		this.addListeners();
		this.appendScripts();
		
		// Add livelinks listeners	
		this.livelinksObserver.observe(document.getElementById('u0_1'), {
				subtree: true,
				childList: true
		});
				
		if (this.config.new_page_notify) {
			this.newPageObserver.observe(document.getElementById('nextpage'), {
					attributes: true
			});
		}
		
		this.addChristmasCss();
	}
};



// Entry point
chrome.runtime.sendMessage({
	
	need: "config",
	tcs: true
	
}, (config) => {
	messageList.init.call(messageList, config);
});