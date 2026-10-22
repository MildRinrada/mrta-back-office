
function validate()
{
	$('#frm_main').validate({
		errorPlacement: function(error, element) {
			error.insertAfter(element.closest('.row-ans').length ? element.closest('.row-ans').children().last() : element);
		}
	});
	if ($('#frm_main').valid()) {
		$('#frm_main').attr('action', "/learnext/admin/feedback/update");
		$('#frm_main').removeAttr('target');
		save();
	}
	else {
		$('.error:first').focus();
		return false;
	}
}

function save() {
	$('#btn_save').prop('disabled', 'disabled').find('span').text('กำลังบันทึก...');
	$('#frm_main').submit();
}

function preview()
{
	$('#frm_main').validate({
		errorPlacement: function(error, element) {
			error.insertAfter(element.closest('.row-ans').length ? element.closest('.row-ans').children().last() : element);
		}
	});
	if ($('#frm_main').valid()) {
		$('#frm_main').attr('action', "/learnext/admin/feedback/preview");
		$('#frm_main').attr('target', '_blank');
		$('#frm_main').submit();
	}
	else {
		$('.error:first').focus();
		return false;
	}
}

$(document).ready(function() {
	$('#panel_answer_list').on('click', '.btn-delete-option', function(e) {
		e.preventDefault();
		if ($('#panel_answer_list > .row-ans:visible').length <= 2) {
			return false;
		}
		if (confirm('ต้องการลบตัวเลือกนี้ใช่หรือไม่?')) {
			$(this).closest('.row-ans').remove();
		}
	});

	$('#btn_add_more_option').on('click', function(e) {
		e.preventDefault();
		e.stopImmediatePropagation();
		$('#panel_answer_list > .tpl-ans:first')
			.clone()
			.removeClass('tpl-ans d-none')
			.appendTo('#panel_answer_list');
		$('#panel_answer_list > .row-ans:last').find(':text:first').val('').focus();
	});

	// Always start with at least two answer options on a brand new question.
	while ($('#panel_answer_list > .row-ans:visible').length < 2) {
		$('#btn_add_more_option').trigger('click');
	}

	$('#frm_main :text:first').focus();
});
