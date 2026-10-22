
function validate() 
{
	$('#frm_main').validate({
		errorPlacement: function(error, element) {
       	if (element.attr('type') == 'file') {
       		error.insertBefore(element.siblings('.help-text'));
       	}
       	else if (element.hasClass('kt_datepicker')) {
       		error.insertAfter(element.closest('.input-group.date'));
       	}
       	else {
          	error.insertAfter(element);
       	}
      }
	});
	if ($('#frm_main').valid()) {
		$('#frm_main').attr('action', "/learnext/admin/assignment/question/update");
		$('#frm_main').removeAttr('target');
		save(3);
	}
	else {
		$('.error:first').focus();
		return false;
	}
}

function save(opt=1) {
	$('#btn_save').prop('disabled', 'disabled').text("\u0e01\u0e33\u0e25\u0e31\u0e07\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01...");
	$('#save_option').val(opt);
	$('#frm_main').submit();
}

function preview()
{
	$('#frm_main').validate({
		errorPlacement: function(error, element) {
       	if (element.attr('type') == 'file') {
       		error.insertBefore(element.siblings('.help-text'));
       	}
       	else if (element.hasClass('kt_datepicker')) {
       		error.insertAfter(element.closest('.input-group.date'));
       	}
       	else {
          	error.insertAfter(element);
       	}
      }
	});
	if ($('#frm_main').valid()) {
		$('#frm_main').attr('action', "/learnext/admin/assignment/question/preview");
		$('#frm_main').attr('target', '_blank');
		$('#frm_main').submit();
	}
	else {
		$('.error:first').focus();
		return false;
	}
}

$(document).ready(function() {
	$('.summernote').summernote({
   	height: 150,
   	callbacks:{
	onPaste: function(e) {
         console.log('paste it')
         const bufferText = ((e.originalEvent || e).clipboardData || window.clipboardData).getData('Text')
         e.preventDefault()
         setTimeout(function () {
             document.execCommand('insertText', false, bufferText)
         }, 10)
     },
	},
   	toolbar: [
		    // [groupName, [list of button]]
		    ['style', ['clear', 'bold', 'italic', 'underline']],
		    ['font', ['strikethrough', 'superscript', 'subscript']],
		    ['fontsize', ['fontsize']],
		    ['color', ['color']],
		    ['para', ['ul', 'ol', 'paragraph']],
		    ['table', ['table']],
  			 ['insert', ['link', 'picture', 'video']],
		  ]
   });
	$(':text:first').focus();
});
