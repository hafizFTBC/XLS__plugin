/* Notification functionality */

var app = (function () {
    "use strict";

    var app = {};

    // Common initialization function (to be called from each page)
    app.initialize = function () {
        // var notificationContainer = document.getElementById("notification-containers");
        $('#notification-container').append(
            '<div id="notification-message" >' +
            // '<div class="padding">' +
            '<div id="notification-message-close"></div>' +
            '<div id="icon-container"><div id="notification-message-header"></div></div>' +
            '<div id="notification-message-body"></div>' +
            '</div>' +
            '</div>');

        $('#notification-message-close').click(function () {
            $('#notification-message').hide();
        });


        // After initialization, expose a common notification function
        app.showNotification = function (header,  type) {
            // $('#notification-message-header').html("");
            $("#icon-container").html("")
            if (type == 'success') {
                $("#notification-message").css("color", "#529374")
                $("#icon-container").append(
                    `<img class="successMsg" src="./images/tick.svg" />`
                )

            } else {
                $("#notification-message").css("color", "#C81919")
                $("#icon-container").append(
                    `<img class="failMsg" src="./images/error_icon.svg" />`
                )
            }
            $('#icon-container').append(header);
            $('#notification-message').slideDown('fast');
        };
    };

    return app;
})();