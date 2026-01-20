from rest_framework import serializers
from users.serializers import UserSimpleSerializer
from workspaces.models import WorkSpace, WorkSpaceMember


class WorkSpaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkSpace
        fields = ['id', 'title']


class WorkSpaceMemberSerializer(serializers.ModelSerializer):
    member = UserSimpleSerializer(read_only=True)

    class Meta:
        model = WorkSpaceMember
        fields = '__all__'
