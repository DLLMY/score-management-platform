



class TestAdminNotificationsRoutes:






    def test_get_notifications_list(self, client, app, auth_headers):

        with app.app_context():



            response = client.get('/api/admin_notifications/', headers=auth_headers)





            assert response.status_code == 200





            data = response.get_json()



            assert isinstance(data, dict)





    def test_get_notifications_with_filter(self, client, app, auth_headers):








        with app.app_context():

            response = client.get('/api/admin_notifications/?is_read=false', headers=auth_headers)



            assert response.status_code == 200






    def test_get_notifications_pagination(self, client, app, auth_headers):



        with app.app_context():



            response = client.get('/api/admin_notifications/?page=1&per_page=10', headers=auth_headers)











            assert response.status_code == 200



    def test_get_notification_counts(self, client, app, auth_headers):

        with app.app_context():

            response = client.get('/api/admin_notifications/count', headers=auth_headers)

            assert response.status_code == 200

            data = response.get_json()

            assert 'unread_count' in data

            assert 'total_count' in data



    def test_delete_notification(self, client, app, auth_headers):

        with app.app_context():

            response = client.delete('/api/admin_notifications/1', headers=auth_headers)

            assert response.status_code == 200 or response.status_code == 404



    def test_create_notification(self, client, app, auth_headers):

        with app.app_context():

            response = client.post(

                '/api/admin_notifications/',

                json={'title': '测试通知', 'message': '测试内容', 'type': 'info', 'priority': 'medium'},

                headers=auth_headers

            )

            assert response.status_code == 201 or response.status_code == 200
