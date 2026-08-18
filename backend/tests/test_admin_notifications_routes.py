



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

            # F9-B 合并后统一返回 APIResponse 信封 {success, code, data:{unread_count, total_count}}
            assert 'data' in data

            assert 'unread_count' in data['data']

            assert 'total_count' in data['data']



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

    def test_mark_read(self, client, app, auth_headers):
        with app.app_context():
            resp = client.post(
                '/api/admin_notifications/',
                json={'title': '置读测试', 'message': '内容'},
                headers=auth_headers,
            )
            nid = resp.get_json()['data']['notification']['id']
            mark = client.post('/api/admin_notifications/%d/read' % nid, headers=auth_headers)
            assert mark.status_code == 200
            assert mark.get_json()['success'] is True
            assert '已标记为已读' in mark.get_json()['message']

    def test_mark_all_read(self, client, app, auth_headers):
        with app.app_context():
            client.post('/api/admin_notifications/', json={'title': 'A', 'message': 'a'}, headers=auth_headers)
            client.post('/api/admin_notifications/', json={'title': 'B', 'message': 'b'}, headers=auth_headers)
            resp = client.post('/api/admin_notifications/read_all', headers=auth_headers)
            assert resp.status_code == 200
            body = resp.get_json()
            assert body['success'] is True
            assert body['data']['count'] >= 2
            assert '已标记' in body['message']
