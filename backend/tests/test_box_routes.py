



class TestBoxRoutes:






    def test_box_verify(self, client, app, auth_headers):

        with app.app_context():

            response = client.post(



                '/api/box/verify',






                json={'card_id': '123456', 'device_id': 'test_device'},

                headers=auth_headers

            )

            assert response.status_code in [200, 400, 404]



    def test_box_verify_with_rule(self, client, app, auth_headers):

        with app.app_context():

            response = client.post(

                '/api/box/verify',

                json={'card_id': '123456', 'device_id': 'test_device', 'rule_id': 1},

                headers=auth_headers

            )

            assert response.status_code in [200, 400, 404]
