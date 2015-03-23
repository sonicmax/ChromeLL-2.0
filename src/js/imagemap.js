var imagemap = {
	cacheData: {},
	currentPage: 1,
	lastPage: '?',			
	init: function() {
		this.getImagemap(this.processResponse);
	},
	getImagemap: function(callback) {
		var page;
		(this.currentPage === 1)
				? page = ''
				: page = '?page=' + this.currentPage;
		var url = window.location.protocol + '//images.endoftheinter.net/imagemap.php' + page;
		var xhr = new XMLHttpRequest();
		xhr.open("GET", url, true);
		xhr.onload = function() {
			if (xhr.status == 200) {
				var html = document.createElement('html');
				html.innerHTML = this.responseText;						
				callback.call(imagemap, html);
			}
		}
		xhr.send();
	},			
	processResponse: function(imagemap) {
		var imageGrid = this.scrape(imagemap);
		var infobar = imagemap.getElementsByClassName('infobar')[1];
		var anchors = infobar.getElementsByTagName('a');					
		this.lastPage = anchors[anchors.length - 1].innerHTML;
		this.createPopup.call(this, imageGrid);
		this.sendToEncoder(imageGrid);
	},
	scrape: function(imagemap) {
		var imageGrid = imagemap.getElementsByClassName('image_grid')[0];
		this.restore(function(cached) {
			var imgs = imageGrid.getElementsByTagName('img');
			for (var i = 0, len = imgs.length; i < len; i++) {
				var img = imgs[i];
				var src = img.src;
				if (cached.imagemap 
						&& cached.imagemap[src]) {
					// replace img src with cached base64 strings
					img.setAttribute('oldsrc', img.src);
					img.src = cached.imagemap[src].data;							
				}
			}
		});
		var blockDescs = imageGrid.getElementsByClassName('block_desc');
		var gridBlocks = imageGrid.getElementsByClassName('grid_block');
		for (var i = 0, len = blockDescs.length; i < len; i++) {
			var blockDesc = blockDescs[i];
			blockDesc.style.display = 'none';
		}
		for (var i = 0, len = gridBlocks.length; i < len; i++) {
			var gridBlock = gridBlocks[i];
			gridBlock.title = "Click to copy image code to clipboard";
		}
		return imageGrid;
	},			
	createPopup: function(imageGrid, searchResults) {
		var that = this;
		var div = document.createElement('div');
		var width = window.innerWidth;
		var height = window.innerHeight;
		var bodyClass = document.getElementsByClassName('body')[0];
		var anchorHeight;	
		// TODO - move these to messageList.addCSSRules method
		div.id = "map_div";
		div.style.position = "fixed";				
		div.style.width = (width * 0.95) + 'px';
		div.style.height = (height * 0.95) / 2 + 'px';
		div.style.left = (width - (width * 0.975)) + 'px';
		div.style.top = (height - (height * 0.975)) + 'px';
		div.style.boxShadow = "5px 5px 7px black";		
		div.style.borderRadius = '6px';	
		div.style.opacity = 1;
		div.style.backgroundColor = 'white';
		div.style.overFlow = 'scroll';
		if (searchResults) {
			var header = document.createElement('div');
			var text = document.createTextNode('Displaying results for query "' + query + '" :');
			header.appendChild(text);
			header.style.color = 'black';
			header.style.position = 'relative';
			header.style.left = '15px';
			header.style.right = '15px';
			header.style.top = '15px';
			header.style.cssFloat = 'left';
			header.style.textAlign = 'left';
			header.style.width = '100%';
			header.style.fontSize = '16px';
			div.appendChild(header);				
			// account for header's style properties
			imageGrid.style.maxHeight = ((height * 0.95) / 2) - 51 + 'px';
			imageGrid.style.maxWidth = (width * 0.95) - 21 + 'px';
		}
		else {
			// subtract 6px to prevent scrollbar from overlapping rounded corners
			imageGrid.style.maxWidth = (width * 0.95) - 6 + 'px';
			imageGrid.style.maxHeight = ((height * 0.95) / 2)  - 6 + 'px';
		}
		imageGrid.style.position = 'relative';
		imageGrid.style.top = '5px';
		imageGrid.style.overflow = 'scroll';
		imageGrid.style.overflowX = 'hidden';
		bodyClass.style.opacity = 0.3;
		if (searchResults) {
			header.appendChild(imageGrid);
		}
		else {
			div.appendChild(imageGrid);
		}
		document.body.appendChild(div);
		document.body.style.overflow = 'hidden';
		bodyClass.addEventListener('mousewheel', this.preventScroll);
		bodyClass.addEventListener('click', this.closePopup);
		div.addEventListener('click', function(evt) {
			that.clickHandler(evt);
			evt.preventDefault();
		});
		if (!searchResults) {
			imageGrid.addEventListener('scroll', this.debouncer.bind(this));
		}
	},
	sendToEncoder: function(imageGrid) {
		var imgs = imageGrid.getElementsByTagName('img');
		for (var i = 0, len = imgs.length; i < len; i++) {
			var img = imgs[i];
			var src = img.src;
			if (img.parentNode.className === 'img-loaded') {
				var href = img.parentNode.parentNode.href;
			}
			else {
				var href = img.parentNode.href;
			}
			this.encodeToBase64(src, href, i, imgs);
		}
	},						
	encodeToBase64: function(src, href, i, imgs) {
		var that = this;
		var canvas = document.createElement('canvas');
		var context = canvas.getContext('2d');
		var img = new Image;
		img.crossOrigin = "Anonymous";
		img.onload = function() {
			var dataURI;
			canvas.height = img.height;
			canvas.width = img.width;
			context.drawImage(img, 0, 0);
			dataURI = canvas.toDataURL();
			var imageData = {
					'dataURI': dataURI, 
					'src': src, 
					'href': href, 
					'index': i
			};
			that.prepareCacheData.call(that, imageData, imgs);
			canvas = null;
		};
		img.src = window.location.protocol + '//cors-for-chromell.herokuapp.com/' + src;
	},
	prepareCacheData: function(imageData, imgs) {
		var dataURI = imageData.dataURI;
		var href = imageData.href;
		var src = imageData.src;
		var i = imageData.index;
		// thumbnails are always jpgs - fullsize image could have a different file format (found in href)			
		var extension = href.match(/\.(gif|jpg|png)$/i)[0];
		var fullsize = src.replace('.jpg', extension);
		fullsize = fullsize.replace('dealtwith.it/i/t', 'endoftheinter.net/i/n');
		var filename = fullsize.match(/\/([^/]*)$/)[1];						
		filename = decodeURIComponent(filename);
		
		if (!filename || !fullsize || !dataURI) {
			console.log('Error while caching image: ', '\n', src, filename, fullsize, dataURI);
			return;
		}
		else {		
			this.cacheData[src] = {"filename": filename, "fullsize": fullsize, "data": dataURI};
			if (i === imgs.length - 1) {
				// Finished encoding images - update cache
				this.restore(this.updateCache);
			}
		}
	},
	updateCache: function(old) {
		var dataToCache = imagemap.cacheData;
		if (!old.imagemap) {
			// first time caching
			var cache = dataToCache;
		}
		else {
			// add current page to existing data
			for (var i in dataToCache) {
				old.imagemap[i] = dataToCache[i];							
			}
			var cache = old.imagemap;
		}
		chrome.storage.local.set({"imagemap": cache}, function() {
			imagemap.cacheData = {};
		});
	},
	restore: function(callback) {
		chrome.storage.local.get("imagemap", function(cache) {
			if (cache === {}) {
				callback(false);
			}
			else if (cache) {
				callback(cache);
			}
		});
	},
	debouncer: function() {
		clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(this.scrollHandler.bind(this), 250);
	},
	debounceTimer: '',
	scrollHandler: function(imageGrid) {
		var that = this;
		var imageGrid = document.getElementsByClassName('image_grid')[0]
		// check whether user is at end of current page
		// (minus 5 pixels from clientHeight to account for large zoom levels)
		if (imageGrid.scrollTop >= imageGrid.scrollHeight - imageGrid.clientHeight - 5) {			
			if (this.currentPage === this.lastPage) {
				// no more pages to load
				return;
			}
			else {
				// load next page and append to current grid
				this.currentPage++;
				this.getImagemap(function(imagemap) {
					var newGrid = that.scrape(imagemap);
					imageGrid.appendChild(newGrid);
					that.sendToEncoder(newGrid);
				});
			}
		}
	},
	clickHandler: function(evt) {
		if (evt.target.id == 'image_search') {
			return;
		}
		else if (evt.target.tagName === 'IMG') {
			// get img code & copy to clipboard via background page
			var clipboard = {};	
			if (evt.target.getAttribute('searchresult')) {
				var src = evt.target.getAttribute('oldsrc'); 
			}
			else {
				if (evt.target.getAttribute('oldsrc')) {
					var src = evt.target.getAttribute('oldsrc'); 
				}
				else {
					var src = evt.target.src;
				}
				var href = evt.target.parentNode.href;					
				var regex = /\.(gif|jpg|png)$/i;
				var extension = href.match(regex);
				var extensionToReplace = src.match(regex);
				// replace thumbnail file extension with file extension of fullsize image
				src = src.replace(extensionToReplace[0], extension[0]);
			}
			// replaces thumbnail location with location of fullsize image
			clipboard.quote =  '<img src="' + src.replace('dealtwith.it/i/t', 'endoftheinter.net/i/n') + '" />';
			chrome.runtime.sendMessage(clipboard);
		}
		// always close popup after click, even if user didn't click on an image
		imagemap.closePopup();
		document.removeEventListener('click', imagemap.clickHandler);
		evt.preventDefault();
	},
	closePopup: function() {
		var div = document.getElementById('map_div');
		if (!div) {
			div = document.getElementById('search_results');				
		}
		var bodyClass = document.getElementsByClassName('body')[0];
		if (div) {
			document.body.removeChild(div);
		}
		bodyClass.style.opacity = 1;
		document.body.style.overflow = 'initial';
		bodyClass.removeEventListener('mousewheel', imagemap.preventScroll);
		imagemap.currentPage = 1;
	},
	preventScroll: function(evt) {
		evt.preventDefault();
	},
	search: {
		init: function() {
			var that = this;
			var query = document.getElementById('image_search').value;
			// make sure that query isnt empty
			if (/\S/.test(query)) {
				this.lookup(query, function(results, query) {
					if (!document.getElementById('search_results')) {
						that.createPopup(query);
					}
					else {
						var oldGrid = document.getElementById('results_grid') || document.getElementById('no_results_grid');								
						oldGrid.remove();
						// display loading_image element while waiting for results div to update
						document.getElementById('loading_image').style.display = 'block';
						
					}							
					that.prepareResults(results, query);
				});
			}
			else {
				// detected empty search box after keyup event - close imagemap popup (if it exists)
				if (document.getElementById('search_results')) {
					imagemap.closePopup();
				}
			}
		},
		lookup: function(query, callback) {				
			var results = [];
			imagemap.restore(function(cached) {
				var cache = cached.imagemap;
				for (var i in cache) {
					var filename = cache[i].filename;
					if (filename.indexOf(query) > -1) {
						results.push(i);
					}
				}
				callback(results, query);
			});				
		},
		prepareResults: function(results, query) {
			var that = this;
			var resultsToShow = results;
			if (results.length === 0) {
				this.formatResults(false, query);
			}
			else {
				imagemap.restore(function(cached) {
					var cache = cached.imagemap;
					var data = {};
					for (var i = 0, len = results.length; i < len; i++) {
						var result = results[i];
						data[result] = cache[result];
					}
					that.formatResults(data, query);
				});
			}
		},
		formatResults: function(data, query) {	
			if (!data) {
				this.updatePopup(false, query);
			}
			else {
				var grid = document.createElement('div');	
				grid.className = 'image_grid';
				grid.id = 'results_grid';
				grid.style.clear = 'left';		
				for (var i in data) {
					var block = document.createElement('div');
					block.className = 'grid_block';
					var img = document.createElement('img');
					img.setAttribute('oldsrc', data[i].fullsize);
					img.setAttribute('searchresult', true);
					img.src = data[i].data;
					block.className = 'grid_block';
					block.style.display = 'inline';
					block.appendChild(img);
					grid.appendChild(block);						
				}
				this.updatePopup(grid, query);
			}
		},
		createPopup: function(query) {
			var header = document.createElement('div');
			var image = document.createElement('img');
			var imageURL = chrome.extension.getURL('/src/images/loading.png');
			image.id = 'loading_image';
			image.style.display = 'block';
			image.style.marginLeft = 'auto';
			image.style.marginRight = 'auto';
			image.style.marginTop = 'auto';
			image.style.marginBottom = 'auto';
			image.src = imageURL;					
			header.innerHTML = 'Displaying results for query "<span id="query">' + query + '</span>" :';					
			var div = document.createElement('div');
			var width = window.innerWidth;
			var height = window.innerHeight;
			var bodyClass = document.getElementsByClassName('body')[0];		
			div.id = "search_results";
			div.style.position = "fixed";				
			div.style.width = (width * 0.95) + 'px';
			div.style.height = (height * 0.95) / 2 + 'px';
			div.style.left = (width - (width * 0.975)) + 'px';
			div.style.top = (height - (height * 0.975)) + 'px';
			div.style.boxShadow = "5px 5px 7px black";		
			div.style.borderRadius = '6px';	
			div.style.backgroundColor = 'white';
			div.style.overFlow = 'scroll';
			header.style.color = 'black';
			header.style.position = 'relative';
			header.style.left = '15px';
			header.style.right = '15px';
			header.style.top = '15px';
			header.style.cssFloat = 'left';
			header.style.textAlign = 'left';
			header.style.width = '100%';
			header.style.fontSize = '16px';
			header.id = 'results_header';
			div.appendChild(header);
			div.appendChild(image);
			document.body.appendChild(div);					
			document.body.style.overflow = 'hidden';
			bodyClass.addEventListener('mousewheel', imagemap.preventScroll);
			bodyClass.addEventListener('click', this.closePopup);
			document.addEventListener('click', this.clickHandler);
		},
		updatePopup: function(results, query) {
			document.getElementById('loading_image').style.display = 'none';
			var popup = document.getElementById('search_results');
			var oldGrid = document.getElementById('results_grid') || document.getElementById('no_results_grid');
			var header = document.getElementById('results_header');	
			var querySpan = document.getElementById('query');
			var width = window.innerWidth;
			var height = window.innerHeight;					
			if (querySpan.innerHTML != query) {				
				querySpan.innerHTML = query;
			}
			if (!results) {
				var textDiv = document.createElement('div');
				var text = document.createTextNode('No matches found.');
				textDiv.id = 'no_results_grid'
				textDiv.style.position = 'relative';
				textDiv.style.top = '5px';
				textDiv.appendChild(text);
				if (oldGrid) {
					if (oldGrid.id === 'no_results_grid') {
						return;
					}
					else {
						oldGrid.remove();	
						header.appendChild(textDiv);
						return;
					}
				}
				else {
					header.appendChild(textDiv);
					return;
				}
			}
			else {
				results.style.maxHeight = ((height * 0.95) / 2) - 51 + 'px';
				results.style.maxWidth = (width * 0.95) - 21 + 'px';
				results.style.position = 'relative';
				results.style.top = '5px';
				results.style.overflow = 'scroll';
				results.style.overflowX = 'hidden';
				if (oldGrid) {
					oldGrid.remove();
				}
				header.appendChild(results);
			}
		}
	}
};