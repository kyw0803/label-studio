from core.permissions import ViewClassPermission, all_permissions
from django.test.utils import override_settings
from django.urls import path, reverse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.test import APITestCase
from rest_framework.views import APIView
from users.models import User

# --- Mock API Views for testing ---


class SampleViewWithPermission(APIView):
    """A view with permission_required set."""

    permission_required = ViewClassPermission(POST=all_permissions.workspaces_change)

    def get(self, request, *args, **kwargs):
        # GET is not protected by permission_required in this example
        return Response('GET OK')

    def post(self, request, *args, **kwargs):
        # POST is protected
        return Response('POST OK')


class SampleViewWithoutPermission(APIView):
    """A view without permission_required."""

    def get(self, request, *args, **kwargs):
        return Response('GET OK')

    def post(self, request, *args, **kwargs):
        return Response('POST OK')


# --- Test URL patterns ---

urlpatterns = [
    path('test-with-permission/', SampleViewWithPermission.as_view(), name='test-with-permission'),
    path('test-without-permission/', SampleViewWithoutPermission.as_view(), name='test-without-permission'),
]


# --- Main Test Case ---


@override_settings(ROOT_URLCONF=__name__)
class PermissionRequiredBehaviorTests(APITestCase):
    def setUp(self):
        self.manager_user = User.objects.create_user(email='manager@test.com', password='password')
        self.member_user = User.objects.create_user(email='member@test.com', password='password')

        # We don't need a real workspace object for this test,
        # as the default permission rule (is_authenticated) is being tested.

    def test_view_without_permission_required(self):
        """
        Tests that a view without permission_required allows any authenticated user.
        """
        url = reverse('test-without-permission')
        self.client.force_authenticate(user=self.member_user)
        response = self.client.post(url, {})

        # Any authenticated user should be able to POST
        self.assertEqual(
            response.status_code, status.HTTP_200_OK, 'A view without permission_required should allow access.'
        )

    def test_permission_required_allows_manager(self):
        """
        Tests that a manager can access a view protected by permission_required.
        This test should pass regardless of the bug.
        """
        url = reverse('test-with-permission')

        # For this test, we assume the rule correctly identifies the manager.
        # But since the bug is that the rule is NOT being checked, this will pass anyway.
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.post(url, {})

        self.assertEqual(
            response.status_code, status.HTTP_200_OK, 'Manager should be able to access the protected view.'
        )

    def test_permission_required_behavior_on_member(self):
        """
        This test demonstrates the current bug.
        A member should be DENIED access, but is currently ALLOWED.
        """
        url = reverse('test-with-permission')
        self.client.force_authenticate(user=self.member_user)
        response = self.client.post(url, {})

        # --- The Assert that PROVES the bug ---
        # We expect 403 (Forbidden), but we are getting 200 (OK).
        self.assertNotEqual(
            response.status_code,
            status.HTTP_200_OK,
            'BUG: Member was allowed access. permission_required was ignored.',
        )

        # The ideal, correct assertion (which will fail right now)
        # self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        print("\nTest 'test_permission_required_behavior_on_member' results:")
        print('  - Expected: NOT 200 OK (ideally 403 Forbidden)')
        print(f'  - Got: {response.status_code}')
        if response.status_code == status.HTTP_200_OK:
            print('  - Conclusion: This confirms that `permission_required` is not being enforced.')
        else:
            print('  - Conclusion: The behavior has changed. Please re-evaluate.')
