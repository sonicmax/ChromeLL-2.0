var allBg = {
	activeListeners : {
		"force_https" : false,
		"batch_uploader" : false
	},
	handle_batch_uploader : function(dest) {
		var headers = dest.requestHeaders;
		var response = {};
		for ( var i in headers) {
			if (headers[i].name == "Referer") {
				headers[i].value = "http://u.endoftheinter.net/u.php";
				break;
			}
		}
		response.requestHeaders = headers;
		return response;
	},
	handle_redirect : function(dest) {
		return {
			redirectUrl : dest.url.replace(/^http/i, "https")
		};
	}
}
// Sync configs to split from the master config and the config option that
// determines if they are synced
var split = {
	"user_highlight_data" : "sync_userhl",
	"keyword_highlight_data" : "sync_cfg",
	"post_template_data" : "sync_cfg",
	"ignorator_list" : "sync_ignorator",
	"ignore_keyword_list" : "sync_ignorator",
	"usernote_notes" : "sync_usernotes"
};
