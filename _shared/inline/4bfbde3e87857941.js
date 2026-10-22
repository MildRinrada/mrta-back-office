
	var article_content_count = 0;

	function initArticleContentEditor(el) {
		if (!el) return;
		tinymce.init({
			target: el,
			license_key: 'gpl',
			promotion: false,
			branding: false,
			menubar: false,
			height: 250,
			plugins: [
				'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
				'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
				'media', 'table', 'wordcount'
			],
			toolbar: 'undo redo | blocks | bold italic underline | forecolor backcolor | ' +
				'alignleft aligncenter alignright | bullist numlist | link image media table | code fullscreen',
			toolbar_mode: 'sliding',
			placeholder: "\u0e40\u0e23\u0e34\u0e48\u0e21\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32\u0e17\u0e35\u0e48\u0e19\u0e35\u0e48...",
			image_advtab: true,
			image_caption: true,
			file_picker_types: 'image',
			images_upload_handler: function(blobInfo) {
				return new Promise(function(resolve, reject) {
					var data = new FormData();
					data.append('image', blobInfo.blob(), blobInfo.filename());
					$.ajax({
						headers: {
							'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
						},
						url: "/belib/admin/upload/summernote-upload-image",
						contentType: false,
						processData: false,
						data: data,
						type: 'post',
					}).done(function(url) {
						resolve(url);
					}).fail(function() {
						reject("\u0e2d\u0e31\u0e1b\u0e42\u0e2b\u0e25\u0e14\u0e23\u0e39\u0e1b\u0e20\u0e32\u0e1e\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08");
					});
				});
			},
			content_style: 'body{font-family:"IBM Plex Sans Thai",sans-serif;font-size:14px;color:#2d3436;line-height:1.7;}'
		});
	}

	function addArticleContentBlock() {
		article_content_count++;
		var id = 'article_content_' + article_content_count;
		var $block = $('<div class="border rounded-3 bg-light"></div>').appendTo('#panel_content');
		var $header = $('<div class="d-flex align-items-center justify-content-between px-3 py-2 border-bottom"></div>').appendTo($block);
		$('<span class="text-muted small fw-semibold"><i class="fa-solid fa-grip-lines me-1"></i>' + "\u0e1a\u0e25\u0e47\u0e2d\u0e01\u0e17\u0e35\u0e48 :num".replace(':num', article_content_count) + '</span>').appendTo($header);
		$('<button type="button" class="btn btn-sm btn-outline-danger btn-delete-block"><i class="fa-regular fa-trash-can me-1"></i>' + "\u0e25\u0e1a\u0e41\u0e16\u0e27\u0e19\u0e35\u0e49" + '</button>').appendTo($header);
		var $body = $('<div class="p-3"></div>').appendTo($block);
		$('<textarea id="' + id + '" class="article-content-block" name="description[]"></textarea>').appendTo($body);
		initArticleContentEditor(document.getElementById(id));
	}

	$(document).ready(function() {
		article_content_count = $('.article-content-block').length;

		$('.article-content-block').each(function() {
			initArticleContentEditor(this);
		});

		$('#btn_add_block_text').click(function(e) {
			e.preventDefault();
			addArticleContentBlock();
		});

		$('#btn_add_block_media').click(function(e) {
			e.preventDefault();
			addArticleContentBlock();
		});

		$('body').on('click', '.btn-delete-block', function() {
			if (confirm("\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e25\u0e1a\u0e1a\u0e25\u0e47\u0e2d\u0e01\u0e19\u0e35\u0e49\u0e43\u0e0a\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48?")) {
				var $block = $(this).closest('.bg-light');
				var textareaId = $block.find('textarea').attr('id');
				var editor = tinymce.get(textareaId);
				if (editor) editor.remove();
				$block.remove();
			}
		});
	});
