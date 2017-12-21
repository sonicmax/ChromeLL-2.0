// Original code by Milan

const UPLOAD_SIZE_LIMIT = 4000000; // 4MB

var imgurNotificationId;

function imageTransloader(info, shouldRename) {
	var url = checkUrl(info.srcUrl);
	var filename = getFilename(info.srcUrl);
	
	if (shouldRename) {
		var newFilename = handleRename(filename);
		if (newFilename === false) {
			return;
		}
		else if (newFilename) {
			filename = newFilename;
		}
	}
	
	fetchImage(url, (filesize, mimetype, blob) => {
		// GIFs larger than UPLOAD_SIZE_LIMIT will not upload to ETI correctly. Use Imgur instead
		if (filesize > UPLOAD_SIZE_LIMIT && mimetype === 'image/gif') {
			uploadToImgur(blob);
		}
		
		else {
			uploadToEti(blob, filename);
		}
		
	});
}

/**
 *  Called before transloading to handle some edge cases
 */

function checkUrl(url) {	
	// Create temp anchor to simplify process of parsing URL
	var anchor = document.createElement('a');
	anchor.href = url;

	// Fix for sites where the actual image URL is located in the query string (eg WaPo)	
	if (url.split(anchor.protocol).length > 2) {
		var queryUrl = url.split(anchor.protocol)[2];		
		if (hasImage(queryUrl)) {
			return anchor.protocol + queryUrl;
		}
	}
	
	return url;
}

function getFilename(url) {	
	var filename = url.substring(url.lastIndexOf('/') + 1);	
	
	// Remove query parameters. Do this after splitting last path segment to handle weird cases
	// where the query string is the actual file path
	filename = filename.split('?')[0];
	filename = filename.split('&')[0];
	
	// Make sure that filename isn't empty
	if (!filename) {
		filename = 'untitled.jpg';
	}
	
	// Facebook id fix
	if (/fbcdn\-sphotos/.test(url)) {
		filename = 'fb.jpg';
	}
	
	// We need to do some extra work to handle Wikia URLs
	if (/vignette[0-9].wikia.nocookie.net/.test(url)) {
	
		// We want to make sure that we transload the full size image
		if (/scale-to-width-down\/\d+/.test(url)) {
			var match = url.match(/scale-to-width-down\/\d+/)[0];
			url = url.replace(match, '');
		}
		
		// Wikia image URL paths can be weird (eg filename.jpg/revision/latest), so the filename is probably incorrect
		var splitUrl = url.split('/');
		for (var i = 0, len = splitUrl.length; i < len; i++) {
			var segment = splitUrl[i];
			if (/.(gif|jpg|png)/.test(segment)) {
				filename = segment;
				break;
			}
		}
	}
	
	// We have to trim .webp extension from wikiHow image URLs
	if (/whstatic.com\/images/.test(url)) {
		filename = filename.replace('.webp', '');		
	}
	
	return filename;
}

function hasImage(url) {
	return /.(gif|jpg|png)/.test(url);
}

function handleRename(filename) {
	var extensionCheck = filename.match(/\.(gif|jpg|png)$/i);
		
	var originalExtension;
			
	if (extensionCheck) {
		originalExtension = extensionCheck[0];
		filename = filename.replace(originalExtension, '');
	}
	
	var newFilename = prompt('Enter new filename:', filename);
	
	if (newFilename === null) {
		// User pressed cancel. Return false to cancel upload
		return false;
	}
	
	else if (!/\S/.test(newFilename)) {
		// User entered blank filename, but presumably still wanted to upload something. Return null
		return;
	}
	
	else if (newFilename.match(/\.(gif|jpg|png)$/i)) {
		
		var newExtension = newFilename.match(/\.(gif|jpg|png)$/i)[0];
		
		// Make sure that new filename has correct extension			
		if (originalExtension && newExtension != originalExtension) {
			newFilename = newFilename.replace(newExtension, originalExtension);
		}

		return newFilename;	
	}
	
	else {
		// If originalExtension is undefined, we let ETI handle the file extension.
		if (originalExtension) {
			return newFilename + originalExtension;
		}
		else {
			return newFilename;
		}
	}
}

function fetchImage(url, callback) {
	// Fetch the image
	var fileGet = new XMLHttpRequest();
	fileGet.open('GET', url, true);
	fileGet.responseType = 'arraybuffer';
	
	fileGet.onload = () => {
		if (fileGet.status === 200) {
			// Get metadata
			var filesize = fileGet.getResponseHeader('Content-Length');
			var mimetype = fileGet.getResponseHeader('Content-Type');
			
			// Create blob
			var dataview = new DataView(fileGet.response);
			var blob = new Blob([dataview]);
			
			callback(filesize, mimetype, blob);
		} 
		
		else {
			console.log('Error ', fileGet.statusText);
		}
	};
	
	fileGet.send();
}

function uploadToEti(blob, filename) {
	const ETI_UPLOAD_ENDPOINT = 'http://u.endoftheinter.net/u.php';
	// Construct FormData object containing image blob
	var formData = new FormData();
	formData.append('file', blob, filename);

	// Upload to ETI
	var xhr = new XMLHttpRequest();
	xhr.open('POST', ETI_UPLOAD_ENDPOINT, true);

	xhr.onload = () => {
		
		if (xhr.status === 200) {
			var responseText = xhr.responseText;
			var value = scrapeValue(responseText);
			
			if (value) {			
				copyToClipboard(value);			
			}
			
		} else {
			console.log('Error ', xhr.statusText);
		}
	}
		// send FormData object to ETI
	xhr.send(formData);	
}

function scrapeValue(response) {
	try {
		// Spooky HTML regex. The 1st group contains the string we are looking for
		var valueRegex = /<input value="(<img src=&quot;+.+&quot;\s\/>)"/;
		var matches = response.match(valueRegex);
		
		return matches[1].replace(/&quot;/g, '"');
		
	} catch (e) {
		console.log('Error in spooky HTML regex:', e);
		
		try {
			// This method is not ideal as Chrome will try to load these images using the
			// chrome-extension: protocol, causing multiple network errors. But it's preferable 
			// to doing nothing
			
			var html = document.createElement('html');
			html.innerHTML = response;
			
			return html.getElementsByClassName('img')[0].getElementsByTagName('input')[0].value;
			
		} catch (e2) {
			console.log('Error parsing HTML:', e2);
			return;
		}
	}		
}

function uploadToImgur(blob) {
	const IMGUR_UPLOAD_ENDPOINT = 'https://api.imgur.com/3/image';
	const API_KEY = 'Client-ID 6356976da2dad83';
	var formData = new FormData();
	formData.append('image', blob);
	
	var xhr = new XMLHttpRequest();
	xhr.open('POST', IMGUR_UPLOAD_ENDPOINT, true);
	xhr.setRequestHeader('Authorization', API_KEY);
	
	xhr.onload = () => {
		if (xhr.status === 200) {	
			var jsonResponse = JSON.parse(xhr.responseText);
			var url = jsonResponse.data.gifv;
			copyToClipboard(url);
		}		
		else {
			showErrorNotification(xhr.status);
		}
	};
	
	xhr.upload.addEventListener('progress', (evt) => {
		if (imgurNotificationId) {
			
			var update = {};
			
			if (evt.lengthComputable) {
				var percentage = Math.round((evt.loaded / evt.total) * 100);
				
				if (percentage === '100%') {
					update.type = 'basic';
					update.contextMessage = 'Waiting for response...';
				}
				else {
					update.progress = percentage;
				}
				
				chrome.notifications.update(imgurNotificationId, update);
			}
		}	
	});
	
	showImgurNotification(xhr);
	
	xhr.send(formData);
}

function showImgurNotification(xhr) {
	chrome.notifications.create('fail', {
		
		type: 'progress',
		title: 'Too big to fail',
		message: 'This gif is too big (>2MB) - uploading to Imgur...',
		progress: 0,
		buttons: [{
			title: 'Cancel'
		}],
		requireInteraction: true,
		iconUrl: 'src/images/lueshi_48_i.png'
		
	}, (id) => {
		
		imgurNotificationId = id;
		
		chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
			
			if (notifId === id && btnIdx === 0) {
				xhr.abort();
				chrome.notifications.clear(id, null);
			}
			
		});
		
	});
}

function showErrorNotification(statusCode) {
	chrome.notifications.create('fail', {
		
		type: 'basic',
		title: 'Image transloading failed',
		message: 'Error while uploading to Imgur. Status code: ' + statusCode,	
		iconUrl: 'src/images/lueshi_48_i.png'
		
	}, (id) => {
		
		setTimeout(() => {
			chrome.notifications.clear(id, null);	
		}, 3000);
		
	});
}

function copyToClipboard(text) {
	var clipboard = document.getElementById('clipboard');
	clipboard.value = text;
	clipboard.select();
	document.execCommand('copy');

	if (imgurNotificationId) {
		chrome.notifications.clear(imgurNotificationId, null);
		imgurNotificationId = null;
	}
	
	// Notify user
	chrome.notifications.create('succeed', {
		
		type: 'basic',
		title: 'Image transloaded',
		message: 'The img code is now in your clipboard',
		iconUrl: 'src/images/lueshi_48.png'
		
	}, (id) => {
		
		setTimeout(() => {
			chrome.notifications.clear(id, null);	
		}, 3000);
		
	});		
}