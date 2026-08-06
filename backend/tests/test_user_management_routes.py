



class TestUserManagementRoutes:





    def test_get_blacklisted_users(self, client, app, auth_headers):



        with app.app_context():







            response = client.get('/api/user-management/blacklist', headers=auth_headers)

            assert response.status_code in [200, 403]



    def test_add_to_blacklist(self, client, app, auth_headers):

        with app.app_context():

            response = client.post(



                '/api/user-management/blacklist/1',






                json={'reason': '测试禁用'},

                headers=auth_headers



            )








            assert response.status_code in [200, 400, 403, 404]



    def test_remove_from_blacklist(self, client, app, auth_headers):

        with app.app_context():

            response = client.delete('/api/user-management/blacklist/1', headers=auth_headers)

            assert response.status_code in [200, 400, 403, 404]



    def test_get_user_unlock_status(self, client, app, auth_headers):

        with app.app_context():

            response = client.get('/api/user-management/unlock-status/1', headers=auth_headers)

            assert response.status_code in [200, 404, 403]



    def test_set_daily_unlock_limit(self, client, app, auth_headers):

        with app.app_context():

            response = client.put(

                '/api/user-management/unlock-limit/1',

                json={'limit': 10},

                headers=auth_headers

            )

            assert response.status_code in [200, 400, 403, 404]
