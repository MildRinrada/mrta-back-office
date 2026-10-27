
        function validate() {
            $('#frm_main').validate();
            if ($('#frm_main').valid()) {
                save();
            } else {
                scrollToClass('error');
                return false;
            }
        }

        $(document).ready(function() {
            $(':text:first').focus();

            $('select[name="group_id"]').change(function(e) {
                e.preventDefault();

                $.ajax({
                        headers: {
                            'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
                        },
                        url: "/belib/admin/article/category/ajax-get-parent-by-group",
                        type: 'POST',
                        data: {
                            id: $(this).val(),
                            this_id: $('input[name="id"]').val()
                        },
                        dataType: 'json',
                        cache: false,
                        beforeSend: function() {
                            $('.spinner-border').removeClass('d-none');
                        },
                    })
                    .done(function(resp) {
                        if (resp.status == '200') {
                            var options = $('select[name="parent_id"]').empty();
                            options.append($("<option />").val('').text(''));
                            $.each(resp.result, function() {
                                options.append($("<option />").val(this.id).text(this.title));
                            });
                                                                                        
                            $('.spinner-border').addClass('d-none');
                        } else {
                            $('.spinner-border').html(resp.msg).removeClass('d-none');
                        }
                    })
                    .fail(function(resp) {
                        $('.spinner-border').html(resp.msg).removeClass('d-none');
                    });
            });

            // Init for edit mode
                                                });
    